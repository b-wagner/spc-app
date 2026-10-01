import {
  normalizeSearchQuery,
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

test("camera constraints clamp restored coordinates and zoom", () => {
  expect(constrainCamera([-160, 60], 99)).toEqual({
    center: [-125, 50],
    zoom: MAX_ZOOM,
  });
  expect(constrainCamera([-97, 35], -1).zoom).toBe(MIN_ZOOM);
  expect(isInsideNationalBounds([-66, 50])).toBe(true);
  expect(isInsideNationalBounds([-157, 21])).toBe(false);
});
