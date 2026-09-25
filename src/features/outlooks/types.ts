import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
export type OutlookDay = 1 | 2 | 3;
export type CategoryCode = "TSTM" | "MRGL" | "SLGT" | "ENH" | "MDT" | "HIGH";
/** Geographic degrees, always longitude first. Never rounded before lookup. */
export type LonLat = readonly [longitude: number, latitude: number];
export interface CategoryProperties {
  category: CategoryCode;
  /** Ordinal severity: TSTM=0, HIGH=5; not the provider's dn code. */
  rank: number;
  sourceDn: number;
  sourceObjectId: number | string;
}
export interface OutlookSnapshot {
  schemaVersion: 1;
  day: OutlookDay;
  layerId: number;
  kind: "forecast" | "empty-unverified";
  /** UTC epoch milliseconds; null only for empty-unverified responses. */
  issuedAt: number | null;
  validFrom: number | null;
  expiresAt: number | null;
  /** Body retrieval time, unchanged by conditional revalidation. */
  downloadedAt: number;
  /** Most recent successful fetch or 304 revalidation, UTC epoch ms. */
  checkedAt: number;
  sourceUrl: string;
  sourceProductId: string | null;
  etag: string | null;
  lastModified: string | null;
  httpFreshUntil: number | null;
  noStore: boolean;
  geojson: FeatureCollection<Polygon | MultiPolygon, CategoryProperties>;
}
export interface RequestState {
  snapshot: OutlookSnapshot | null;
  network: "idle" | "loading" | "refreshing" | "error";
  error: string | null;
  lastAttempt: number | null;
  retryAt: number;
  failures: number;
}
export type OutlookStates = Record<OutlookDay, RequestState>;
export const DAYS: readonly OutlookDay[] = [1, 2, 3];
