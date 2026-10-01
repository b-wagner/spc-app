import type { LonLat, OutlookSnapshot, RequestState } from "./types";
import { getPointCategory } from "./pointRisk";
import { categoryLabel } from "./categories";
export const OUTSIDE_COPY =
  "This view covers SPC outlooks for the contiguous US. An unshaded point is not a guarantee that severe weather cannot occur.";
/** Temporal state is derived from the clock, never frozen at download time. */
export function temporalState(snapshot: OutlookSnapshot | null, now: number) {
  if (!snapshot || snapshot.kind === "empty-unverified") return "unavailable";
  if (now >= snapshot.expiresAt!) return "expired";
  return now < snapshot.validFrom! ? "upcoming" : "valid";
}
/** Available upcoming forecasts are inspectable for their stated future period. */
export function assessPoint(
  snapshot: OutlookSnapshot | null,
  point: LonLat,
  now: number,
) {
  const state = temporalState(snapshot, now);
  if (state === "unavailable" || state === "expired")
    return {
      category: null,
      label:
        state === "expired"
          ? "This outlook has expired."
          : "Outlook unavailable.",
      state,
    };
  const category = getPointCategory(snapshot!, point);
  return {
    category,
    label: category
      ? categoryLabel(category)
      : "Not inside a displayed outlook area.",
    state,
  };
}
/** Network failure and cached temporal validity are independent. */
export function statusMessage(
  state: RequestState,
  day: number,
  now: number,
): string | null {
  const s = state.snapshot;
  if (s && now < s.checkedAt - 300000) return "Device time may be incorrect.";
  if (state.network === "error") {
    if (s?.kind === "empty-unverified")
      return "Couldn't update. The last check returned no verifiable outlook geometry.";
    if (temporalState(s, now) === "expired")
      return "Couldn't update. The saved outlook has expired.";
    return s
      ? "Couldn't update. Showing saved outlook."
      : "Outlook unavailable. Try again or open SPC.";
  }
  if (s?.kind === "empty-unverified")
    return "No outlook geometry returned. Forecast availability could not be confirmed.";
  if (temporalState(s, now) === "expired") return "This outlook has expired.";
  if (!s)
    return state.network === "loading"
      ? `Loading Day ${day} outlook…`
      : "Outlook unavailable. Try again or open SPC.";
  if (now - s.checkedAt > 1800000)
    return "Update overdue. Showing saved outlook.";
  return null;
}
