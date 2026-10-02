import { render, waitFor } from "@testing-library/react-native";
import { TextEncoder } from "node:util";
import {
  canLoadForecastDiscussion,
  ForecastDiscussion,
} from "@/components/ForecastDiscussion";
import {
  fetchForecastDiscussion,
  parseForecastDiscussion,
  type DiscussionTransport,
} from "@/features/discussion/client";

Object.assign(globalThis, { TextEncoder });

const expected = {
  issuedAt: Date.UTC(2026, 8, 30, 12, 57),
  validFrom: Date.UTC(2026, 8, 30, 13),
  expiresAt: Date.UTC(2026, 9, 1, 12),
};

const product = `ZCZC SPCSWODY1 ALL
ACUS01 KWNS 301257
SPC AC 301257

Day 1 Convective Outlook
NWS Storm Prediction Center Norman OK
0757 AM CDT Wed Sep 30 2026

Valid 301300Z - 011200Z

...SUMMARY...
Severe thunderstorms are possible across parts of the southern Plains.

...DISCUSSION...
Storm development is expected during the afternoon.

..Forecaster.. 09/30/2026

$$`;

function response(status: number, text: string): DiscussionTransport {
  return async () =>
    ({
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers({ "content-type": "text/plain" }),
      text: async () => text,
    }) as Response;
}

test("plain-text discussion parser preserves readable sections and metadata", () => {
  expect(parseForecastDiscussion(product, 1)).toMatchObject({
    day: 1,
    title: "Day 1 Convective Outlook",
    issuedLabel: "0757 AM CDT Wed Sep 30 2026",
    validLabel: "Valid 301300Z - 011200Z",
  });
  expect(parseForecastDiscussion(product, 1).text).toContain("...DISCUSSION...");
});

test("discussion parser rejects markup and the wrong day", () => {
  expect(() => parseForecastDiscussion("<html>blocked</html>", 1)).toThrow(
    "DISCUSSION_UNAVAILABLE",
  );
  expect(() => parseForecastDiscussion(product, 2)).toThrow(
    "DISCUSSION_UNAVAILABLE",
  );
});

test("discussion must match the displayed outlook product", () => {
  expect(parseForecastDiscussion(product, 1, expected).validLabel).toContain(
    "301300Z",
  );
  expect(() =>
    parseForecastDiscussion(product, 1, {
      ...expected,
      validFrom: Date.UTC(2026, 8, 29, 13),
    }),
  ).toThrow("DISCUSSION_MISMATCH");
});

test("historical demo mode cannot request a live discussion", () => {
  expect(canLoadForecastDiscussion(expected, true)).toBe(false);
  expect(canLoadForecastDiscussion(expected, false)).toBe(true);
  expect(canLoadForecastDiscussion(null, false)).toBe(false);
});

test("discussion client distinguishes unavailable and service errors", async () => {
  await expect(
    fetchForecastDiscussion(1, new AbortController().signal, response(404, "")),
  ).rejects.toThrow("DISCUSSION_UNAVAILABLE");
  await expect(
    fetchForecastDiscussion(1, new AbortController().signal, response(503, "")),
  ).rejects.toThrow("DISCUSSION_SERVICE_ERROR");
});

test("discussion component renders loading then matching safe text", async () => {
  const view = render(
    <ForecastDiscussion
      day={1}
      expected={expected}
      transport={response(200, product)}
    />,
  );
  expect(view.getByText("Loading discussion…")).toBeTruthy();
  await waitFor(() => expect(view.getByText("Day 1 Convective Outlook")).toBeTruthy());
  expect(view.getByText(/Storm development is expected/)).toBeTruthy();
});

test("discussion component renders unavailable and error states", async () => {
  const unavailable = render(
    <ForecastDiscussion
      day={1}
      expected={expected}
      transport={response(404, "")}
    />,
  );
  await waitFor(() =>
    expect(unavailable.getByText(/matching Forecast Discussion/)).toBeTruthy(),
  );
  const error = render(
    <ForecastDiscussion
      day={1}
      expected={expected}
      transport={response(500, "")}
    />,
  );
  await waitFor(() =>
    expect(error.getByText(/could not be loaded/)).toBeTruthy(),
  );
  expect(error.getByRole("button", { name: "Retry discussion" })).toBeTruthy();
});

test("discussion component reports a mismatched live product", async () => {
  const view = render(
    <ForecastDiscussion
      day={1}
      expected={{ ...expected, expiresAt: Date.UTC(2026, 9, 2, 12) }}
      transport={response(200, product)}
    />,
  );
  await waitFor(() =>
    expect(view.getByText(/does not match this saved outlook/)).toBeTruthy(),
  );
});
