/** Adapter boundary: reject the entire product instead of silently dropping a dangerous polygon. */
import type { MultiPolygon, Polygon, Position } from "geojson";
import { AppError } from "@/utils/errors";
import { CATEGORIES } from "./categories";
import { parseSpcUtc } from "./timestamps";
import { LAYERS, queryUrl } from "./sourceConfig";
import type { OutlookDay, OutlookSnapshot } from "./types";
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Valid finite geographic coordinates; optional altitude is deliberately stripped. */
export function validCoordinates(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}
function ring(value: unknown): Position[] {
  if (
    !Array.isArray(value) ||
    value.length < 4 ||
    !value.every(validCoordinates)
  )
    throw new AppError("INVALID_GEOMETRY");
  const points = value.map((p) => [p[0], p[1]]);
  const a = points[0],
    b = points[points.length - 1];
  if (
    a[0] !== b[0] ||
    a[1] !== b[1] ||
    new Set(points.map((p) => p.join(","))).size < 3
  )
    throw new AppError("INVALID_GEOMETRY");
  return points;
}
function polygon(value: unknown): Position[][] {
  if (!Array.isArray(value) || !value.length)
    throw new AppError("INVALID_GEOMETRY");
  return value.map(ring);
}
/** Preserves ring holes and disconnected parts; no repair, simplification, or axis swapping. */
export function normalizeGeometry(value: unknown): Polygon | MultiPolygon {
  if (!isRecord(value)) throw new AppError("INVALID_GEOMETRY");
  if (value.type === "Polygon")
    return { type: "Polygon", coordinates: polygon(value.coordinates) };
  if (
    value.type === "MultiPolygon" &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length
  )
    return {
      type: "MultiPolygon",
      coordinates: value.coordinates.map(polygon),
    };
  throw new AppError("INVALID_GEOMETRY");
}
/** Validates the NOAA layer contract (IMPLEMENTATION_V0_1.md §6), including one consistent UTC tuple. */
export function normalizeOutlook(
  raw: unknown,
  day: OutlookDay,
  now: number,
): OutlookSnapshot {
  if (
    !isRecord(raw) ||
    raw.error ||
    raw.type !== "FeatureCollection" ||
    !Array.isArray(raw.features)
  )
    throw new AppError("INVALID_JSON");
  if (
    raw.exceededTransferLimit === true ||
    (isRecord(raw.properties) && raw.properties.exceededTransferLimit === true)
  )
    throw new AppError("INCOMPLETE_RESPONSE");
  let tuple: number[] | null = null;
  let product: string | null = null;
  const features: OutlookSnapshot["geojson"]["features"] = raw.features.map(
    (f: unknown) => {
      if (!isRecord(f) || f.type !== "Feature" || !isRecord(f.properties))
        throw new AppError("INVALID_GEOMETRY");
      const p = Object.fromEntries(
        Object.entries(f.properties).map(([k, v]) => [k.toLowerCase(), v]),
      );
      const dn =
        typeof p.dn === "number" && Number.isInteger(p.dn)
          ? p.dn
          : typeof p.dn === "string" && /^\d+$/.test(p.dn)
            ? Number(p.dn)
            : NaN;
      const category = CATEGORIES.find((c) => c.dn === dn);
      if (
        p.label !== null &&
        p.label !== undefined &&
        typeof p.label !== "string"
      )
        throw new AppError("UNSUPPORTED_CATEGORY");
      const label =
        typeof p.label === "string" ? p.label.trim().toUpperCase() : null;
      if (!category || (label && label !== category.code))
        throw new AppError("UNSUPPORTED_CATEGORY");
      const times = [
        parseSpcUtc(p.issue),
        parseSpcUtc(p.valid),
        parseSpcUtc(p.expire),
      ];
      if (times[0] > times[2] || times[1] >= times[2])
        throw new AppError("INVALID_TIMESTAMPS");
      if (tuple && times.some((t, i) => t !== tuple![i]))
        throw new AppError("MIXED_PRODUCT");
      tuple = times;
      if (typeof p.idp_source === "string") product = p.idp_source;
      return {
        type: "Feature",
        geometry: normalizeGeometry(f.geometry),
        properties: {
          category: category.code,
          rank: category.rank,
          sourceDn: dn,
          sourceObjectId:
            typeof p.objectid === "string" || typeof p.objectid === "number"
              ? p.objectid
              : "",
        },
      };
    },
  );
  return {
    schemaVersion: 1,
    day,
    layerId: LAYERS[day],
    kind: features.length ? "forecast" : "empty-unverified",
    issuedAt: tuple?.[0] ?? null,
    validFrom: tuple?.[1] ?? null,
    expiresAt: tuple?.[2] ?? null,
    downloadedAt: now,
    checkedAt: now,
    sourceUrl: queryUrl(day),
    sourceProductId: product,
    etag: null,
    lastModified: null,
    httpFreshUntil: null,
    noStore: false,
    geojson: { type: "FeatureCollection", features },
  };
}
/** Cache JSON is untrusted too. Revalidate geometry, category and timestamps before hydration. */
export function validateCachedSnapshot(
  raw: unknown,
  day: OutlookDay,
): OutlookSnapshot {
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== 1 ||
    raw.day !== day ||
    raw.layerId !== LAYERS[day] ||
    !isRecord(raw.geojson) ||
    raw.geojson.type !== "FeatureCollection" ||
    !Array.isArray(raw.geojson.features)
  )
    throw new AppError("INVALID_CACHE");
  for (const k of ["downloadedAt", "checkedAt"])
    if (typeof raw[k] !== "number" || !Number.isFinite(raw[k]))
      throw new AppError("INVALID_CACHE");
  if (!["forecast", "empty-unverified"].includes(String(raw.kind)))
    throw new AppError("INVALID_CACHE");
  if (raw.kind === "forecast") {
    if (
      ["issuedAt", "validFrom", "expiresAt"].some(
        (k) => typeof raw[k] !== "number" || !Number.isFinite(raw[k]),
      ) ||
      Number(raw.issuedAt) > Number(raw.expiresAt) ||
      Number(raw.validFrom) >= Number(raw.expiresAt) ||
      !raw.geojson.features.length
    )
      throw new AppError("INVALID_CACHE");
  } else if (
    raw.geojson.features.length ||
    raw.issuedAt !== null ||
    raw.validFrom !== null ||
    raw.expiresAt !== null
  )
    throw new AppError("INVALID_CACHE");
  for (const f of raw.geojson.features) {
    if (!isRecord(f) || f.type !== "Feature" || !isRecord(f.properties))
      throw new AppError("INVALID_CACHE");
    const props = f.properties;
    const c = CATEGORIES.find((c) => c.code === props.category);
    if (!c || c.dn !== f.properties.sourceDn || c.rank !== f.properties.rank)
      throw new AppError("INVALID_CACHE");
    normalizeGeometry(f.geometry);
  }
  if (
    raw.noStore !== false ||
    (raw.httpFreshUntil !== null &&
      (typeof raw.httpFreshUntil !== "number" ||
        !Number.isFinite(raw.httpFreshUntil)))
  )
    throw new AppError("INVALID_CACHE");
  if (
    ["etag", "lastModified", "sourceProductId"].some(
      (k) => raw[k] !== null && typeof raw[k] !== "string",
    )
  )
    throw new AppError("INVALID_CACHE");
  return { ...raw, sourceUrl: queryUrl(day) } as unknown as OutlookSnapshot;
}
