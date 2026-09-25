import day1 from "../../../test/fixtures/day1.json";
import day2 from "../../../test/fixtures/day2.json";
import day3 from "../../../test/fixtures/day3.json";
import type { Fetcher } from "./scheduler";
/** Explicit offline development mode only; never used to recover a live network failure. */
export const fixtureFetcher: Fetcher = async (day) => ({
  kind: "body",
  raw: { 1: day1, 2: day2, 3: day3 }[day],
  meta: { etag: null, lastModified: null, httpFreshUntil: null, noStore: true },
});
