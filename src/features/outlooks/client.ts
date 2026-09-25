/** Weather HTTP transport only. Native map traffic has a separate header/cache path. */
import { AppError } from "@/utils/errors";
import type { Clock } from "@/utils/clock";
import { queryUrl, USER_AGENT } from "./sourceConfig";
import type { OutlookDay, OutlookSnapshot } from "./types";
export type HttpTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
export interface HttpMetadata {
  etag: string | null;
  lastModified: string | null;
  httpFreshUntil: number | null;
  noStore: boolean;
}
export type FetchResult =
  | { kind: "not-modified"; meta: HttpMetadata }
  | { kind: "body"; raw: unknown; meta: HttpMetadata };
export const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
/** Retry-After may be delta seconds or an HTTP date; malformed values are ignored. */
export function retryAfter(value: string | null, now: number) {
  if (!value) return 0;
  if (/^\d+$/.test(value.trim())) return now + Number(value) * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.max(now, parsed) : 0;
}
/** Derives freshness from origin age, not receipt time alone. no-store also clears validators. */
export function httpMetadata(headers: Headers, now: number): HttpMetadata {
  const control = headers.get("cache-control")?.toLowerCase() ?? "";
  const noStore = /(?:^|,)\s*no-store(?:\s|,|$)/.test(control);
  const max = control.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/);
  const date = Date.parse(headers.get("date") ?? "");
  const age = Math.max(0, Number(headers.get("age")) || 0) * 1000;
  const apparentAge = Number.isFinite(date) ? Math.max(0, now - date) : 0;
  let fresh: number | null = null;
  if (max)
    fresh =
      now + Math.max(0, Number(max[1]) * 1000 - Math.max(age, apparentAge));
  else {
    const expires = Date.parse(headers.get("expires") ?? "");
    if (Number.isFinite(expires))
      fresh =
        now +
        Math.max(
          0,
          expires -
            (Number.isFinite(date) ? date : now) -
            Math.max(age, apparentAge),
        );
  }
  if (noStore || /(?:^|,)\s*no-cache(?:\s|,|$|=)/.test(control)) fresh = now;
  return {
    etag: noStore ? null : headers.get("etag"),
    lastModified: noStore ? null : headers.get("last-modified"),
    httpFreshUntil: fresh,
    noStore,
  };
}
/** One 15-second request (including body read); caller owns retry scheduling and cancellation. */
export async function fetchOutlook(
  day: OutlookDay,
  cached: OutlookSnapshot | null,
  signal: AbortSignal,
  clock: Clock,
  transport: HttpTransport = fetch,
): Promise<FetchResult> {
  const controller = new AbortController();
  const startedAt = clock.now();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  if (signal.aborted) abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const headers: Record<string, string> = {
      Accept: "application/geo+json, application/json",
      "User-Agent": USER_AGENT,
    };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.lastModified)
      headers["If-Modified-Since"] = cached.lastModified;
    const response = await transport(queryUrl(day), {
      headers,
      signal: controller.signal,
    });
    if (__DEV__)
      console.info("outlook_http", {
        day,
        status: response.status,
        durationMs: clock.now() - startedAt,
      });
    const meta = httpMetadata(response.headers, clock.now());
    if (response.status === 304) return { kind: "not-modified", meta };
    if (!response.ok)
      throw new AppError(
        response.status === 429 ? "RATE_LIMITED" : `HTTP_${response.status}`,
        `HTTP ${response.status}`,
        [429, 503].includes(response.status)
          ? retryAfter(response.headers.get("retry-after"), clock.now())
          : 0,
      );
    if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES)
      throw new AppError("RESPONSE_TOO_LARGE");
    const type = response.headers.get("content-type");
    if (type && !/(?:json|geo\+json)/i.test(type))
      throw new AppError("INVALID_JSON");
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES)
      throw new AppError("RESPONSE_TOO_LARGE");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError("INVALID_JSON");
    }
    return { kind: "body", raw, meta };
  } catch (error) {
    if (timedOut) throw new AppError("TIMEOUT");
    if (signal.aborted) throw new AppError("CANCELED");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
