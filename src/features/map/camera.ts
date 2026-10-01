import type { LonLat } from "@/features/outlooks/types";

/** Lower-48 viewport limits in MapLibre's [west, south, east, north] order. */
export const NATIONAL_BOUNDS: [number, number, number, number] = [
  -125, 24, -66, 50,
];
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 12;
export const MAP_PADDING = { top: 20, bottom: 20, left: 20, right: 20 };

/** True when a coordinate can be shown inside the app's contiguous-U.S. map. */
export function isInsideNationalBounds([longitude, latitude]: LonLat) {
  return (
    longitude >= NATIONAL_BOUNDS[0] &&
    longitude <= NATIONAL_BOUNDS[2] &&
    latitude >= NATIONAL_BOUNDS[1] &&
    latitude <= NATIONAL_BOUNDS[3]
  );
}

/** Keeps restored camera preferences compatible with the native map limits. */
export function constrainCamera(center: LonLat, zoom: number) {
  return {
    center: [
      Math.max(NATIONAL_BOUNDS[0], Math.min(NATIONAL_BOUNDS[2], center[0])),
      Math.max(NATIONAL_BOUNDS[1], Math.min(NATIONAL_BOUNDS[3], center[1])),
    ] as LonLat,
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
  };
}
