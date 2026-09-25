import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { CategoryCode, LonLat, OutlookSnapshot } from "./types";
/** Highest category in full source geometry. Boundaries are included; holes are preserved.
 * Null means outside displayed polygons, never an all-clear or a coverage assertion.
 * Caller must gate expiry/availability through assessPoint before presenting a result. */
export function getPointCategory(
  snapshot: OutlookSnapshot,
  point: LonLat,
): CategoryCode | null {
  let rank = -1,
    result: CategoryCode | null = null;
  const p = turfPoint([...point]);
  for (const f of snapshot.geojson.features)
    if (
      f.properties.rank > rank &&
      booleanPointInPolygon(p, f, { ignoreBoundary: false })
    ) {
      rank = f.properties.rank;
      result = f.properties.category;
    }
  return result;
}
