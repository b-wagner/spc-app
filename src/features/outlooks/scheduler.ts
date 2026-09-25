/** Single global queue owns requests. Screens never fetch. Generations invalidate canceled/cleared results. */
import type { Clock } from "@/utils/clock";
import { AppError, errorCode } from "@/utils/errors";
import type { FetchResult } from "./client";
import { acceptResponse, type ForecastStore } from "./repository";
import {
  DAYS,
  type OutlookDay,
  type OutlookSnapshot,
  type OutlookStates,
  type RequestState,
} from "./types";
export type Fetcher = (
  day: OutlookDay,
  cached: OutlookSnapshot | null,
  signal: AbortSignal,
) => Promise<FetchResult>;
const initial = (): RequestState => ({
  snapshot: null,
  network: "idle",
  error: null,
  lastAttempt: null,
  retryAt: 0,
  failures: 0,
});
/** Stateful service, with injected clock/transport/persistence for deterministic tests. */
export class OutlookScheduler {
  states: OutlookStates = { 1: initial(), 2: initial(), 3: initial() };
  private listeners = new Set<() => void>();
  private queue: OutlookDay[] = [];
  private pending = new Map<
    OutlookDay,
    { promise: Promise<void>; resolve: () => void }
  >();
  private active = true;
  private running: OutlookDay | null = null;
  private controller: AbortController | null = null;
  private generation = 0;
  private clearing = false;
  private storageTail: Promise<void> = Promise.resolve();
  constructor(
    private clock: Clock,
    private fetcher: Fetcher,
    private store: ForecastStore,
    private storageFailure: () => void,
    private random = Math.random,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((f) => f());
  }
  private update(day: OutlookDay, patch: Partial<RequestState>) {
    this.states = { ...this.states, [day]: { ...this.states[day], ...patch } };
    this.emit();
  }
  /** Cache appears before network requests begin. Only weather failures degrade to memory. */
  async hydrate() {
    try {
      const cache = await this.store.load();
      for (const day of DAYS)
        if (cache[day]) this.update(day, { snapshot: cache[day] });
    } catch {
      this.storageFailure();
    }
  }
  /** Retry deadline includes manual throttling; automatic expiry cannot spin in a loop. */
  deadline(day: OutlookDay, manual = false) {
    const s = this.states[day],
      now = this.clock.now();
    const minimum = s.lastAttempt === null ? 0 : s.lastAttempt + 60000;
    if (
      manual ||
      s.failures ||
      !s.snapshot ||
      (s.snapshot.expiresAt !== null && now >= s.snapshot.expiresAt)
    )
      return Math.max(minimum, s.retryAt);
    return Math.max(
      minimum,
      s.retryAt,
      s.snapshot.checkedAt + 900000,
      s.snapshot.httpFreshUntil ?? 0,
    );
  }
  /** Selected-day requests move ahead of queued background days, while in-flight work is shared. */
  enqueue(day: OutlookDay, manual = false, priority = false): Promise<void> {
    const existing = this.pending.get(day);
    if (existing) {
      if (priority && this.queue.includes(day))
        this.queue = [day, ...this.queue.filter((d) => d !== day)];
      return existing.promise;
    }
    if (
      !this.active ||
      this.clearing ||
      this.clock.now() < this.deadline(day, manual)
    )
      return Promise.resolve();
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.pending.set(day, { promise, resolve });
    if (priority) this.queue.unshift(day);
    else this.queue.push(day);
    void this.drain();
    return promise;
  }
  private persist(operation: () => Promise<void>) {
    const task = this.storageTail.then(operation);
    this.storageTail = task.catch(() => {
      this.storageFailure();
    });
    return this.storageTail;
  }
  private async drain() {
    if (this.running !== null || !this.active || this.clearing) return;
    const day = this.queue.shift();
    if (!day) return;
    this.running = day;
    const generation = this.generation;
    const startedAt = this.clock.now();
    const controller = new AbortController();
    this.controller = controller;
    const old = this.states[day].snapshot;
    this.update(day, {
      network: old ? "refreshing" : "loading",
      lastAttempt: this.clock.now(),
      error: null,
    });
    try {
      let result = await this.fetcher(day, old, controller.signal);
      // Exactly one unconditional recovery, never an unbounded 304 retry chain.
      if (result.kind === "not-modified" && !old)
        result = await this.fetcher(day, null, controller.signal);
      if (generation !== this.generation || controller.signal.aborted) return;
      const snapshot = acceptResponse(result, old, day, this.clock.now());
      this.update(day, {
        snapshot,
        network: "idle",
        failures: 0,
        retryAt: 0,
        error: null,
      });
      if (__DEV__)
        console.info("outlook_accepted", {
          day,
          durationMs: this.clock.now() - startedAt,
          featureCount: snapshot.geojson.features.length,
          issuedAt: snapshot.issuedAt,
          validFrom: snapshot.validFrom,
          expiresAt: snapshot.expiresAt,
          revalidated: result.kind === "not-modified",
        });
      await this.persist(() =>
        snapshot.noStore ? this.store.remove(day) : this.store.put(snapshot),
      );
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      const failures = this.states[day].failures + 1;
      const code = errorCode(error);
      const base = ["HTTP_403", "HTTP_404"].includes(code)
        ? 900000
        : Math.min(900000, 60000 * 2 ** (failures - 1));
      const retryAt = Math.max(
        this.clock.now() + base * (1 + this.random() * 0.1),
        error instanceof AppError ? error.retryAt : 0,
      );
      this.update(day, { network: "error", error: code, failures, retryAt });
      if (__DEV__) console.info("outlook_request_failed", { day, code });
    } finally {
      if (controller.signal.aborted || generation !== this.generation)
        this.update(day, { network: "idle" });
      this.running = null;
      this.controller = null;
      this.pending.get(day)?.resolve();
      this.pending.delete(day);
      void this.drain();
    }
  }
  /** Backgrounding cancels the current transport, resolves queued waiters, and owns no timer. */
  setActive(active: boolean) {
    this.active = active;
    if (!active) {
      this.generation++;
      this.controller?.abort();
      for (const day of this.queue) {
        this.pending.get(day)?.resolve();
        this.pending.delete(day);
      }
      this.queue = [];
    } else void this.drain();
  }
  /** Clear is serialized after previous writes so a late write cannot resurrect a deleted cache. */
  async clear() {
    this.clearing = true;
    this.generation++;
    this.controller?.abort();
    for (const day of this.queue) {
      this.pending.get(day)?.resolve();
      this.pending.delete(day);
    }
    this.queue = [];
    const running =
      this.running === null ? null : this.pending.get(this.running)?.promise;
    this.states = { 1: initial(), 2: initial(), 3: initial() };
    this.emit();
    if (running) await running;
    try {
      await this.storageTail;
      await this.store.clear();
    } catch {
      this.storageFailure();
      throw new AppError("STORAGE_ERROR");
    } finally {
      this.clearing = false;
    }
  }
}
