import { OutlookScheduler, type Fetcher } from "@/features/outlooks/scheduler";
import { normalizeOutlook } from "@/features/outlooks/normalize";
import type { FetchResult } from "@/features/outlooks/client";
import type { ForecastStore } from "@/features/outlooks/repository";
import { AppError } from "@/utils/errors";
import { FIXTURE_TIME } from "@/utils/clock";
import { allCategories, collection } from "./fixtures/synthetic";
const meta = {
  etag: "v1",
  lastModified: null,
  httpFreshUntil: null,
  noStore: false,
};
const body: FetchResult = { kind: "body", raw: allCategories, meta };
function setup(fetcher: Fetcher = jest.fn(async () => body)) {
  let now = FIXTURE_TIME;
  const store: ForecastStore = {
    load: jest.fn(async () => ({})),
    put: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  const warning = jest.fn();
  const scheduler = new OutlookScheduler(
    { now: () => now },
    fetcher,
    store,
    warning,
    () => 0,
  );
  return {
    scheduler,
    store,
    warning,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
test("hydrates before delayed network and retains cache on failure", async () => {
  const old = normalizeOutlook(allCategories, 1, FIXTURE_TIME - 900001);
  const ctx = setup(async () => {
    throw new AppError("TIMEOUT");
  });
  ctx.store.load = async () => ({ 1: old });
  await ctx.scheduler.hydrate();
  expect(ctx.scheduler.states[1].snapshot).toBe(old);
  await ctx.scheduler.enqueue(1);
  expect(ctx.scheduler.states[1].snapshot).toBe(old);
  expect(ctx.scheduler.states[1].network).toBe("error");
});
test("deduplicates consumers, serializes products, and prioritizes selected queued day", async () => {
  const resolvers: ((r: FetchResult) => void)[] = [];
  const calls: number[] = [];
  const ctx = setup((day) => {
    calls.push(day);
    return new Promise((r) => resolvers.push(r));
  });
  const one = ctx.scheduler.enqueue(1),
    duplicate = ctx.scheduler.enqueue(1),
    two = ctx.scheduler.enqueue(2),
    three = ctx.scheduler.enqueue(3, false, true);
  expect(one).toBe(duplicate);
  expect(calls).toEqual([1]);
  resolvers.shift()!(body);
  await one;
  expect(calls).toEqual([1, 3]);
  resolvers.shift()!(body);
  await three;
  expect(calls).toEqual([1, 3, 2]);
  resolvers.shift()!(body);
  await two;
  expect(ctx.scheduler.states[1].snapshot?.day).toBe(1);
  expect(ctx.scheduler.states[2].snapshot?.day).toBe(2);
});
test("304 updates check time only and one unconditional recovery without body", async () => {
  let response: FetchResult = body;
  const fetcher = jest.fn(async () => response);
  const ctx = setup(fetcher);
  await ctx.scheduler.enqueue(1);
  const downloaded = ctx.scheduler.states[1].snapshot!.downloadedAt;
  ctx.advance(900000);
  response = { kind: "not-modified", meta };
  await ctx.scheduler.enqueue(1);
  expect(ctx.scheduler.states[1].snapshot!.downloadedAt).toBe(downloaded);
  expect(ctx.scheduler.states[1].snapshot!.checkedAt).toBe(downloaded + 900000);
  const second = setup(jest.fn(async () => response));
  await second.scheduler.enqueue(2);
  expect(second.scheduler.states[2].error).toBe("MISSING_304_BODY");
});
test("304 recovery invokes only twice", async () => {
  const fetcher = jest
    .fn<ReturnType<Fetcher>, Parameters<Fetcher>>()
    .mockResolvedValueOnce({ kind: "not-modified", meta })
    .mockResolvedValueOnce(body);
  const ctx = setup(fetcher);
  await ctx.scheduler.enqueue(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][1]).toBeNull();
});
test("manual throttle, HTTP freshness, expiration override and backoff", async () => {
  const fetcher = jest.fn(async () => ({
    ...body,
    meta: { ...meta, httpFreshUntil: FIXTURE_TIME + 3600000 },
  }));
  const ctx = setup(fetcher);
  await ctx.scheduler.enqueue(1);
  ctx.advance(59000);
  await ctx.scheduler.enqueue(1, true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  ctx.advance(841000);
  await ctx.scheduler.enqueue(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await ctx.scheduler.enqueue(1, true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const failing = setup(async () => {
    throw new AppError("RATE_LIMITED", "429", FIXTURE_TIME + 600000);
  });
  await failing.scheduler.enqueue(1);
  expect(failing.scheduler.deadline(1, true)).toBe(FIXTURE_TIME + 600000);
  failing.advance(60000);
  await failing.scheduler.enqueue(1, true);
  expect(failing.scheduler.states[1].failures).toBe(1);
});
test("expiration overrides long server freshness but throttles repeated expired 304", async () => {
  const fetcher = jest.fn(async () => ({
    ...body,
    meta: { ...meta, httpFreshUntil: FIXTURE_TIME + 7 * 86400000 },
  }));
  const ctx = setup(fetcher);
  await ctx.scheduler.enqueue(1);
  ctx.advance(86400000);
  await ctx.scheduler.enqueue(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await ctx.scheduler.enqueue(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test("no-store removes older durable body; empty success replaces active geometry", async () => {
  let response = body;
  const ctx = setup(async () => response);
  await ctx.scheduler.enqueue(1);
  ctx.advance(900000);
  response = {
    kind: "body",
    raw: collection(),
    meta: { ...meta, noStore: true, etag: null },
  };
  await ctx.scheduler.enqueue(1);
  expect(ctx.scheduler.states[1].snapshot?.kind).toBe("empty-unverified");
  expect(ctx.store.remove).toHaveBeenCalledWith(1);
  expect(ctx.store.put).toHaveBeenCalledTimes(1);
});
test("background cancels quietly and ignores late success", async () => {
  let resolve!: (r: FetchResult) => void;
  const ctx = setup(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const p = ctx.scheduler.enqueue(1);
  ctx.scheduler.setActive(false);
  resolve(body);
  await p;
  expect(ctx.scheduler.states[1].snapshot).toBeNull();
  expect(ctx.scheduler.states[1].error).toBeNull();
  ctx.scheduler.setActive(true);
  expect(ctx.scheduler.states[1].network).toBe("idle");
});
test("clear invalidates requests, validators and all days", async () => {
  const ctx = setup();
  await ctx.scheduler.enqueue(1);
  await ctx.scheduler.clear();
  expect(ctx.scheduler.states[1].snapshot).toBeNull();
  expect(ctx.store.clear).toHaveBeenCalledTimes(1);
  expect(ctx.scheduler.states[1].lastAttempt).toBeNull();
});
test("weather write failure keeps usable in-memory data and emits storage notice", async () => {
  const ctx = setup();
  ctx.store.put = async () => {
    throw Error("disk full");
  };
  await ctx.scheduler.enqueue(1);
  expect(ctx.scheduler.states[1].snapshot).not.toBeNull();
  expect(ctx.warning).toHaveBeenCalled();
});
