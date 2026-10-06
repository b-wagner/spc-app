import type { SQLiteDatabase } from "expo-sqlite";
import { LocalSearchProvider } from "@/features/search/LocalSearchProvider";
import { parseSearchQuery, normalizePlaceName, normalizeSearchText } from "@/features/search/normalize";
import { MAX_SEARCH_RESULTS } from "@/features/search/repository";
import { constrainCamera, isInsideNationalBounds, MAX_ZOOM, MIN_ZOOM } from "@/features/map/camera";

const database = (overrides: Partial<SQLiteDatabase> = {}) =>
  ({ getFirstAsync: jest.fn(), getAllAsync: jest.fn(), ...overrides }) as unknown as SQLiteDatabase;

test("normalization folds punctuation and accents consistently", () => {
  expect(normalizeSearchText("  St.  Lóuis,   MO ")).toBe("st louis mo");
  expect(normalizePlaceName("Norman city")).toBe("norman");
  expect(() => parseSearchQuery("A")).toThrow("INVALID_SEARCH");
  expect(() => parseSearchQuery("1234")).toThrow("INVALID_SEARCH");
  expect(() => parseSearchQuery("Austin\u0000 TX")).toThrow("INVALID_SEARCH");
  expect(parseSearchQuery("  Norman, Oklahoma ")).toEqual({ kind: "city", city: "norman", state: "OK" });
  expect(parseSearchQuery("01234")).toEqual({ kind: "zip", zip: "01234" });
});

test("ZIP lookup is exact and preserves leading zeroes", async () => {
  const db = database({ getFirstAsync: jest.fn().mockResolvedValue({ zip: "01234", longitude: -73.1, latitude: 42.2 }) });
  await expect(new LocalSearchProvider(db).search("01234", new AbortController().signal)).resolves.toEqual([
    { id: "zip:01234", label: "ZIP 01234", coordinates: [-73.1, 42.2] },
  ]);
  expect(db.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("zip = ?"), "01234");
});

test("city lookup ranks exact matches before stable prefix matches", async () => {
  const db = database({
    getAllAsync: jest.fn()
      .mockResolvedValueOnce([{ geoid: "4052500", name: "Norman city", state_abbreviation: "OK", longitude: -97.44, latitude: 35.22 }])
      .mockResolvedValueOnce(Array.from({ length: 10 }, (_, index) => ({ geoid: `x${index}`, name: `Norman ${index} city`, state_abbreviation: "OK", longitude: -97.3, latitude: 35.2 }))),
  });
  const results = await new LocalSearchProvider(db).search("Norman, OK", new AbortController().signal);
  expect(results).toHaveLength(MAX_SEARCH_RESULTS);
  expect(results[0]).toMatchObject({ id: "place:4052500", label: "Norman, OK" });
  expect(db.getAllAsync).toHaveBeenNthCalledWith(1, expect.stringContaining("normalized_name = ? AND state_abbreviation = ?"), ["norman", "OK", MAX_SEARCH_RESULTS]);
});

test("local search rejects canceled requests and invalid map coordinates", async () => {
  const controller = new AbortController();
  controller.abort();
  const db = database();
  await expect(new LocalSearchProvider(db).search("Norman", controller.signal)).rejects.toThrow("CANCELED");
  expect(db.getAllAsync).not.toHaveBeenCalled();
  const badDb = database({ getFirstAsync: jest.fn().mockResolvedValue({ zip: "90210", longitude: -157, latitude: 21 }) });
  await expect(new LocalSearchProvider(badDb).search("90210", new AbortController().signal)).resolves.toEqual([]);
});

test("camera constraints clamp restored coordinates and zoom", () => {
  expect(constrainCamera([-160, 60], 99)).toEqual({ center: [-125, 50], zoom: MAX_ZOOM });
  expect(constrainCamera([-97, 35], -1).zoom).toBe(MIN_ZOOM);
  expect(isInsideNationalBounds([-66, 50])).toBe(true);
  expect(isInsideNationalBounds([-157, 21])).toBe(false);
});
