import type { SQLiteDatabase } from "expo-sqlite";
import { isInsideNationalBounds } from "@/features/map/camera";
import type { SearchResult } from "./types";

export const MAX_SEARCH_RESULTS = 5;

type PlaceRow = {
  geoid: string;
  name: string;
  state_abbreviation: string;
  longitude: number;
  latitude: number;
};

type ZipRow = { zip: string; longitude: number; latitude: number };

const labelName = (name: string) =>
  name.replace(/\s+(city|town|village|borough|municipality|CDP|balance)$/i, "");

const validCoordinates = (longitude: unknown, latitude: unknown) => {
  const coordinates = [Number(longitude), Number(latitude)] as const;
  return (
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1]) &&
    isInsideNationalBounds(coordinates)
  );
};

function toPlaceResult(row: PlaceRow): SearchResult | null {
  if (!validCoordinates(row.longitude, row.latitude)) return null;
  return {
    id: `place:${row.geoid}`,
    label: `${labelName(row.name)}, ${row.state_abbreviation}`,
    coordinates: [row.longitude, row.latitude],
  };
}

export async function findZip(
  db: SQLiteDatabase,
  zip: string,
): Promise<SearchResult[]> {
  const row = await db.getFirstAsync<ZipRow>(
    "SELECT zip, longitude, latitude FROM zctas WHERE zip = ?",
    zip,
  );
  if (!row || !validCoordinates(row.longitude, row.latitude)) return [];
  return [
    {
      id: `zip:${row.zip}`,
      label: `ZIP ${row.zip}`,
      coordinates: [row.longitude, row.latitude],
    },
  ];
}

export async function findPlaces(
  db: SQLiteDatabase,
  city: string,
  state: string | null,
): Promise<SearchResult[]> {
  const where = state
    ? "normalized_name = ? AND state_abbreviation = ?"
    : "normalized_name = ?";
  const exact = await db.getAllAsync<PlaceRow>(
    `SELECT geoid, name, state_abbreviation, longitude, latitude
       FROM census_places WHERE ${where}
       ORDER BY state_abbreviation, geoid LIMIT ?`,
    state ? [city, state, MAX_SEARCH_RESULTS] : [city, MAX_SEARCH_RESULTS],
  );
  const prefixWhere = state
    ? "normalized_name LIKE ? ESCAPE '\\' AND normalized_name <> ? AND state_abbreviation = ?"
    : "normalized_name LIKE ? ESCAPE '\\' AND normalized_name <> ?";
  const prefix = await db.getAllAsync<PlaceRow>(
    `SELECT geoid, name, state_abbreviation, longitude, latitude
       FROM census_places WHERE ${prefixWhere}
       ORDER BY normalized_name, state_abbreviation, geoid LIMIT ?`,
    state
      ? [`${city.replace(/[\\%_]/g, "\\$&")}%`, city, state, MAX_SEARCH_RESULTS]
      : [`${city.replace(/[\\%_]/g, "\\$&")}%`, city, MAX_SEARCH_RESULTS],
  );
  const results: SearchResult[] = [];
  for (const row of [...exact, ...prefix]) {
    const result = toPlaceResult(row);
    if (result && !results.some(({ id }) => id === result.id)) results.push(result);
    if (results.length === MAX_SEARCH_RESULTS) break;
  }
  return results;
}
