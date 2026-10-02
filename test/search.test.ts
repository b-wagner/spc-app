import {
  MAX_RESULT_LABEL_LENGTH,
  MAX_SEARCH_RESULTS,
  normalizeSearchQuery,
  resolveGeocoderUrl,
  searchPlaces,
  type SearchTransport,
} from "@/features/search/client";
import {
  constrainCamera,
  isInsideNationalBounds,
  MAX_ZOOM,
  MIN_ZOOM,
} from "@/features/map/camera";

function response(status: number, value: unknown): SearchTransport {
  return async () =>
    ({
      status,
      ok: status >= 200 && status < 300,
      text: async () =>
        typeof value === "string" ? value : JSON.stringify(value),
    }) as Response;
}

test("search validates input before requesting", async () => {
  expect(() => normalizeSearchQuery(" ")).toThrow("INVALID_SEARCH");
  expect(() => normalizeSearchQuery("A")).toThrow("INVALID_SEARCH");
  expect(() => normalizeSearchQuery("1234")).toThrow("INVALID_SEARCH");
  expect(normalizeSearchQuery("  Norman,   OK ")).toBe("Norman, OK");
});

test("release geocoding requires a configurable non-public endpoint", () => {
  expect(() => resolveGeocoderUrl(undefined, false)).toThrow(
    "SEARCH_NOT_CONFIGURED",
  );
  expect(() =>
    resolveGeocoderUrl("https://nominatim.openstreetmap.org/search", false),
  ).toThrow("SEARCH_NOT_CONFIGURED");
  expect(resolveGeocoderUrl("https://geocoder.example.test/search", false)).toBe(
    "https://geocoder.example.test/search",
  );
  expect(resolveGeocoderUrl(undefined, true)).toBe(
    "https://nominatim.openstreetmap.org/search",
  );
});

test("search constrains request and results to the contiguous United States", async () => {
  const transport = jest.fn(
    response(200, [
      { place_id: 1, display_name: "Norman, Oklahoma", lon: "-97.44", lat: "35.22" },
      { place_id: 2, display_name: "Honolulu, Hawaii", lon: "-157.85", lat: "21.30" },
      { place_id: 3, display_name: "Broken", lon: "none", lat: "35" },
    ]),
  );
  await expect(
    searchPlaces("Norman", new AbortController().signal, transport),
  ).resolves.toEqual([
    {
      id: "1",
      label: "Norman, Oklahoma",
      coordinates: [-97.44, 35.22],
    },
  ]);
  expect(transport.mock.calls[0][0]).toContain("countrycodes=us");
  expect(transport.mock.calls[0][0]).toContain("bounded=1");
});

test("search distinguishes no results and service failures", async () => {
  await expect(
    searchPlaces("00000", new AbortController().signal, response(200, [])),
  ).resolves.toEqual([]);
  await expect(
    searchPlaces("Norman", new AbortController().signal, response(503, [])),
  ).rejects.toThrow("SEARCH_SERVICE_ERROR");
});

test("search locally caps, deduplicates, and sanitizes provider results", async () => {
  const raw = [
    { place_id: "duplicate", display_name: "First", lon: "-97", lat: "35" },
    { place_id: "duplicate", display_name: "Duplicate", lon: "-98", lat: "36" },
    {
      place_id: "long",
      display_name: "x".repeat(MAX_RESULT_LABEL_LENGTH + 1),
      lon: "-97",
      lat: "35",
    },
    { place_id: "bidi", display_name: "Norman\u202e", lon: "-97", lat: "35" },
    ...Array.from({ length: 10 }, (_, index) => ({
      place_id: index,
      display_name: `Place ${index}`,
      lon: String(-100 + index / 10),
      lat: "35",
    })),
  ];
  const results = await searchPlaces(
    "places",
    new AbortController().signal,
    response(200, raw),
  );
  expect(results).toHaveLength(MAX_SEARCH_RESULTS);
  expect(results.filter((result) => result.id === "duplicate")).toHaveLength(1);
  expect(results.some((result) => result.id === "long")).toBe(false);
  expect(results.some((result) => result.id === "bidi")).toBe(false);
});

test("already-canceled search never contacts the provider", async () => {
  const controller = new AbortController();
  const transport = jest.fn(response(200, []));
  controller.abort();
  await expect(searchPlaces("Norman", controller.signal, transport)).rejects.toThrow(
    "CANCELED",
  );
  expect(transport).not.toHaveBeenCalled();
});

test("camera constraints clamp restored coordinates and zoom", () => {
  expect(constrainCamera([-160, 60], 99)).toEqual({
    center: [-125, 50],
    zoom: MAX_ZOOM,
  });
  expect(constrainCamera([-97, 35], -1).zoom).toBe(MIN_ZOOM);
  expect(isInsideNationalBounds([-66, 50])).toBe(true);
  expect(isInsideNationalBounds([-157, 21])).toBe(false);
});
