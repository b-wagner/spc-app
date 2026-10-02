import type { OutlookDay } from "@/features/outlooks/types";
import { AppError } from "@/utils/errors";
import { readBoundedText } from "@/utils/http";

export interface ForecastDiscussion {
  day: OutlookDay;
  title: string;
  issuedLabel: string | null;
  validLabel: string | null;
  text: string;
  sourceUrl: string;
}

export type DiscussionTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface ExpectedDiscussionProduct {
  issuedAt: number;
  validFrom: number;
  expiresAt: number;
}

export function discussionUrl(day: OutlookDay) {
  return `https://www.spc.noaa.gov/products/outlook/day${day}otlk.txt`;
}

function matchesUtcParts(epoch: number, day: number, hour: number, minute: number) {
  const date = new Date(epoch);
  return (
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

/** The text product omits month/year in its UTC headers, so compare its UTC tuple to the cached product. */
export function discussionMatchesProduct(
  lines: string[],
  validLabel: string | null,
  expected: ExpectedDiscussionProduct,
) {
  const issue = lines
    .map((line) => line.trim())
    .map((line) => /^ACUS\d+\s+KWNS\s+(\d{2})(\d{2})(\d{2})\b/i.exec(line))
    .find(Boolean);
  const valid = validLabel
    ? /^Valid\s+(\d{2})(\d{2})(\d{2})Z\s*-\s*(\d{2})(\d{2})(\d{2})Z\s*$/i.exec(
        validLabel,
      )
    : null;
  return Boolean(
    issue &&
      valid &&
      matchesUtcParts(expected.issuedAt, +issue[1], +issue[2], +issue[3]) &&
      matchesUtcParts(expected.validFrom, +valid[1], +valid[2], +valid[3]) &&
      matchesUtcParts(expected.expiresAt, +valid[4], +valid[5], +valid[6]),
  );
}

/** Parses SPC's plain-text outlook product and never accepts markup as prose. */
export function parseForecastDiscussion(
  raw: string,
  day: OutlookDay,
  expected?: ExpectedDiscussionProduct,
): ForecastDiscussion {
  if (!raw.trim() || /<\s*(?:html|script|body)\b/i.test(raw))
    throw new AppError("DISCUSSION_UNAVAILABLE");
  const lines = raw.replace(/\r/g, "").split("\n");
  const titleIndex = lines.findIndex((line) =>
    new RegExp(`^Day ${day} (?:Convective|Severe Thunderstorm) Outlook\\s*$`, "i").test(
      line.trim(),
    ),
  );
  if (titleIndex < 0) throw new AppError("DISCUSSION_UNAVAILABLE");
  const validIndex = lines.findIndex(
    (line, index) => index > titleIndex && /^Valid\s+/i.test(line.trim()),
  );
  const endIndex = lines.findIndex(
    (line, index) => index > titleIndex && line.trim() === "$$",
  );
  const issuedLabel =
    lines
      .slice(titleIndex + 1, validIndex > titleIndex ? validIndex : titleIndex + 6)
      .map((line) => line.trim())
      .find((line) =>
        /^(?:\d{3,4}\s+(?:AM|PM)\s+\S+\s+)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i.test(
          line,
        ),
      ) ?? null;
  const validLabel = validIndex >= 0 ? lines[validIndex].trim() : null;
  if (expected && !discussionMatchesProduct(lines, validLabel, expected))
    throw new AppError("DISCUSSION_MISMATCH");
  const contentStart = validIndex >= 0 ? validIndex + 1 : titleIndex + 1;
  const text = lines
    .slice(contentStart, endIndex > contentStart ? endIndex : undefined)
    .join("\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  if (text.length < 20) throw new AppError("DISCUSSION_UNAVAILABLE");
  return {
    day,
    title: lines[titleIndex].trim(),
    issuedLabel,
    validLabel,
    text,
    sourceUrl: discussionUrl(day),
  };
}

/** Fetches one official SPC plain-text product with a bounded response and timeout. */
export async function fetchForecastDiscussion(
  day: OutlookDay,
  signal: AbortSignal,
  transport: DiscussionTransport = fetch,
  expected?: ExpectedDiscussionProduct,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  if (signal.aborted) abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await transport(discussionUrl(day), {
      signal: controller.signal,
      headers: {
        Accept: "text/plain",
        "User-Agent": "SPCOutlookPrototype/0.2.0",
      },
    });
    if (response.status === 404 || response.status === 204)
      throw new AppError("DISCUSSION_UNAVAILABLE");
    if (!response.ok) throw new AppError("DISCUSSION_SERVICE_ERROR");
    const text = await readBoundedText(
      response,
      512 * 1024,
      "DISCUSSION_SERVICE_ERROR",
    );
    return parseForecastDiscussion(text, day, expected);
  } catch (error) {
    if (signal.aborted) throw new AppError("CANCELED");
    if (error instanceof AppError) throw error;
    throw new AppError(
      timedOut ? "DISCUSSION_TIMEOUT" : "DISCUSSION_SERVICE_ERROR",
    );
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
