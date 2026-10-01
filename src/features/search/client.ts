import { AppError } from "@/utils/errors";
import type { LonLat } from "@/features/outlooks/types";
import { isInsideNationalBounds } from "@/features/map/camera";

export const GEOCODER_URL = "https://nominatim.openstreetmap.org/search";
export const SEARCH_TIMEOUT_MS = 10000;
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

async function respectPublicRateLimit(signal: AbortSignal) {
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
 * Searches the public Nominatim endpoint for a city/place or ZIP code.
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
  const publicService = transport === fetch;
  const cacheKey = query.toLocaleLowerCase("en-US");
  const cached = publicService ? resultCache.get(cacheKey) : undefined;
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
    const response = await transport(`${GEOCODER_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SPCOutlookPrototype/0.2.0",
      },
    });
    if (!response.ok) throw new AppError("SEARCH_SERVICE_ERROR");
    const text = await response.text();
    if (text.length > 1024 * 1024) throw new AppError("SEARCH_SERVICE_ERROR");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError("SEARCH_SERVICE_ERROR");
    }
    if (!Array.isArray(raw)) throw new AppError("SEARCH_SERVICE_ERROR");
    const results: SearchResult[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      const longitude = Number(value.lon),
        latitude = Number(value.lat);
      if (
        typeof value.display_name !== "string" ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude)
      )
        continue;
      const coordinates: LonLat = [longitude, latitude];
      if (!isInsideNationalBounds(coordinates)) continue;
      results.push({
        id:
          typeof value.place_id === "number" ||
          typeof value.place_id === "string"
            ? String(value.place_id)
            : `${longitude},${latitude}`,
        label: value.display_name,
        coordinates,
      });
    }
    if (publicService)
      resultCache.set(cacheKey, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        results,
      });
    return results;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted) throw new AppError("CANCELED");
    throw new AppError(timedOut ? "SEARCH_TIMEOUT" : "SEARCH_SERVICE_ERROR");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
