import {
  fetchOutlook,
  httpMetadata,
  MAX_RETRY_AFTER_MS,
  retryAfter,
  type HttpTransport,
} from "@/features/outlooks/client";
import { FIXTURE_TIME } from "@/utils/clock";
import { readBoundedText } from "@/utils/http";
const clock = { now: () => FIXTURE_TIME };
const headers = (v: Record<string, string>) => new Headers(v);
test("max-age accounts for Date and Age; no-cache and no-store differ", () => {
  expect(
    httpMetadata(
      headers({
        "cache-control": "max-age=3600",
        age: "120",
        date: new Date(FIXTURE_TIME - 60000).toUTCString(),
      }),
      FIXTURE_TIME,
    ).httpFreshUntil,
  ).toBe(FIXTURE_TIME + 3480000);
  expect(
    httpMetadata(
      headers({ "cache-control": "no-cache", etag: "abc" }),
      FIXTURE_TIME,
    ),
  ).toMatchObject({
    etag: "abc",
    noStore: false,
    httpFreshUntil: FIXTURE_TIME,
  });
  expect(
    httpMetadata(
      headers({ "cache-control": "no-store", etag: "abc" }),
      FIXTURE_TIME,
    ),
  ).toMatchObject({ etag: null, noStore: true });
});
test("Retry-After supports seconds and dates", () => {
  expect(retryAfter("120", FIXTURE_TIME)).toBe(FIXTURE_TIME + 120000);
  expect(
    retryAfter(new Date(FIXTURE_TIME + 60000).toUTCString(), FIXTURE_TIME),
  ).toBe(FIXTURE_TIME + 60000);
  expect(retryAfter("invalid", FIXTURE_TIME)).toBe(0);
});
test("Retry-After cannot disable requests indefinitely", () => {
  expect(retryAfter("999999999999999999999", FIXTURE_TIME)).toBe(
    FIXTURE_TIME + MAX_RETRY_AFTER_MS,
  );
  expect(
    retryAfter(new Date(FIXTURE_TIME + 86400000).toUTCString(), FIXTURE_TIME),
  ).toBe(FIXTURE_TIME + MAX_RETRY_AFTER_MS);
  expect(retryAfter(new Date(FIXTURE_TIME - 60000).toUTCString(), FIXTURE_TIME)).toBe(
    FIXTURE_TIME,
  );
});
function response(
  status: number,
  text: string,
  h: Record<string, string> = {},
): HttpTransport {
  return async () =>
    ({
      status,
      ok: status >= 200 && status < 300,
      headers: headers(h),
      text: async () => text,
    }) as Response;
}
test.each([
  ["<html>", {}],
  ["{invalid", { "content-type": "application/json" }],
])("rejects invalid body %s", async (text, h) => {
  await expect(
    fetchOutlook(
      1,
      null,
      new AbortController().signal,
      clock,
      response(200, text, h),
    ),
  ).rejects.toThrow("INVALID_JSON");
});
test("content length budget is checked before reading body", async () => {
  await expect(
    fetchOutlook(
      1,
      null,
      new AbortController().signal,
      clock,
      response(200, "{}", { "content-length": String(11 * 1024 * 1024) }),
    ),
  ).rejects.toThrow("RESPONSE_TOO_LARGE");
});
test("body budget is enforced when content length is absent", async () => {
  await expect(
    readBoundedText(
      {
        headers: new Headers(),
        text: async () => "12345",
      } as Response,
      4,
      "RESPONSE_TOO_LARGE",
    ),
  ).rejects.toThrow("RESPONSE_TOO_LARGE");
});
test("server backoff preserved", async () => {
  await expect(
    fetchOutlook(
      1,
      null,
      new AbortController().signal,
      clock,
      response(429, "", { "retry-after": "120" }),
    ),
  ).rejects.toMatchObject({
    code: "RATE_LIMITED",
    retryAt: FIXTURE_TIME + 120000,
  });
});
test("timeout aborts transport and is distinct from background cancellation", async () => {
  jest.useFakeTimers();
  const transport: HttpTransport = (_, init) =>
    new Promise((_, reject) =>
      init.signal!.addEventListener("abort", () => reject(Error("aborted"))),
    );
  const p = fetchOutlook(
    1,
    null,
    new AbortController().signal,
    clock,
    transport,
  );
  const assertion = expect(p).rejects.toThrow("TIMEOUT");
  await jest.advanceTimersByTimeAsync(15000);
  await assertion;
  jest.useRealTimers();
});
