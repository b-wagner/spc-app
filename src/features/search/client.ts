import { AppError } from "@/utils/errors";
import type { LonLat } from "@/features/outlooks/types";
import { isInsideNationalBounds } from "@/features/map/camera";
import { readBoundedText } from "@/utils/http";

export const GEOCODER_URL = "https://nominatim.openstreetmap.org/search";
export const SEARCH_TIMEOUT_MS = 10000;
export const MAX_SEARCH_RESULTS = 5;
export const MAX_SEARCH_CACHE_ENTRIES = 100;
export const MAX_RESULT_LABEL_LENGTH = 300;
export type SearchTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface SearchResult {
  id: string;
  label: string;
  coordinates: LonLat;
}

const resultCache = new Map<
  string,
  { expiresAt: number; results: SearchResult[] }
>();
let lastPublicRequestAt = 0;

/**
 * Public Nominatim is available only for local development. Release builds
 * must use a configured, Nominatim-compatible proxy/provider whose aggregate
 * quota and upstream selection are controlled outside the installed app.
 */
export function resolveGeocoderUrl(
  configuredValue: string | undefined,
  development: boolean,
) {
  const configured = configuredValue?.trim();
  if (!configured) {
    if (development) return GEOCODER_URL;
    throw new AppError("SEARCH_NOT_CONFIGURED");
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new AppError("SEARCH_NOT_CONFIGURED");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new AppError("SEARCH_NOT_CONFIGURED");
  if (!development && url.hostname === "nominatim.openstreetmap.org")
    throw new AppError("SEARCH_NOT_CONFIGURED");
  return url.toString();
}

export function geocoderUrl() {
  return resolveGeocoderUrl(process.env.EXPO_PUBLIC_GEOCODER_URL, __DEV__);
}

function cacheResult(
  key: string,
  value: { expiresAt: number; results: SearchResult[] },
) {
  const now = Date.now();
  for (const [cachedKey, cached] of resultCache)
    if (cached.expiresAt <= now) resultCache.delete(cachedKey);
  resultCache.delete(key);
  resultCache.set(key, value);
  while (resultCache.size > MAX_SEARCH_CACHE_ENTRIES)
    resultCache.delete(resultCache.keys().next().value!);
}

async function respectPublicRateLimit(signal: AbortSignal) {
  if (signal.aborted) throw new AppError("CANCELED");
  const delay = Math.max(0, 1000 - (Date.now() - lastPublicRequestAt));
  if (!delay) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, delay);
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new AppError("CANCELED"));
    };
    signal.addEventListener("abort", cancel, { once: true });
  });
  if (signal.aborted) throw new AppError("CANCELED");
}

/** Validates explicit, submit-only place searches before contacting a service. */
export function normalizeSearchQuery(value: string) {
  const query = value.trim().replace(/\s+/g, " ");
  if (
    query.length < 2 ||
    query.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(query) ||
    (/^\d+$/.test(query) && !/^\d{5}$/.test(query))
  )
    throw new AppError("INVALID_SEARCH");
  return query;
}

/**
 * Searches the configured Nominatim-compatible endpoint for a city/place or ZIP code.
 *
 * Results are bounded and revalidated locally because the map deliberately
 * covers only the contiguous United States. Requests occur only on submit;
 * this is not an autocomplete client.
 */
export async function searchPlaces(
  value: string,
  signal: AbortSignal,
  transport: SearchTransport = fetch,
): Promise<SearchResult[]> {
  const query = normalizeSearchQuery(value);
  const liveTransport = transport === fetch;
  const endpoint = liveTransport ? geocoderUrl() : GEOCODER_URL;
  const publicService =
    liveTransport && new URL(endpoint).hostname === "nominatim.openstreetmap.org";
  const cacheKey = `${endpoint}\u0000${query.toLocaleLowerCase("en-US")}`;
  const cached = liveTransport ? resultCache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  if (signal.aborted) abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SEARCH_TIMEOUT_MS);
  try {
    if (controller.signal.aborted) throw new AppError("CANCELED");
    if (publicService) {
      await respectPublicRateLimit(controller.signal);
      lastPublicRequestAt = Date.now();
    }
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "5",
      countrycodes: "us",
      bounded: "1",
      viewbox: "-125,50,-66,24",
      addressdetails: "0",
    });
    const separator = endpoint.includes("?") ? "&" : "?";
    const response = await transport(`${endpoint}${separator}${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SPCOutlookPrototype/0.2.0",
      },
    });
    if (!response.ok) throw new AppError("SEARCH_SERVICE_ERROR");
    const text = await readBoundedText(
      response,
      1024 * 1024,
      "SEARCH_SERVICE_ERROR",
    );
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError("SEARCH_SERVICE_ERROR");
    }
    if (!Array.isArray(raw)) throw new AppError("SEARCH_SERVICE_ERROR");
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      const longitude = Number(value.lon),
        latitude = Number(value.lat);
      if (
        typeof value.display_name !== "string" ||
        value.display_name.length > MAX_RESULT_LABEL_LENGTH ||
        /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/i.test(
          value.display_name,
        ) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude)
      )
        continue;
      const coordinates: LonLat = [longitude, latitude];
      if (!isInsideNationalBounds(coordinates)) continue;
      const id =
        typeof value.place_id === "number" || typeof value.place_id === "string"
          ? String(value.place_id)
          : `${longitude},${latitude}`;
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({
        id,
        label: value.display_name,
        coordinates,
      });
      if (results.length === MAX_SEARCH_RESULTS) break;
    }
    if (liveTransport)
      cacheResult(cacheKey, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        results,
      });
    return results;
  } catch (error) {
    if (signal.aborted) throw new AppError("CANCELED");
    if (error instanceof AppError) throw error;
    throw new AppError(timedOut ? "SEARCH_TIMEOUT" : "SEARCH_SERVICE_ERROR");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
