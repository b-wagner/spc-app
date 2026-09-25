import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import type { LonLat } from "@/features/outlooks/types";
import { validCoordinates } from "@/features/outlooks/normalize";
import { AppError } from "@/utils/errors";
import type { SavedPlace } from "./types";
/** Names count Unicode code points, not UTF-16 units. Internal line/control characters are forbidden. */
export function validPlaceName(value: string) {
  const n = value.trim();
  return (
    Array.from(n).length >= 1 &&
    Array.from(n).length <= 40 &&
    !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)
  );
}
export function nextPlaceName(places: SavedPlace[]) {
  let n = 1;
  while (places.some((p) => p.name === `Place ${n}`)) n++;
  return `Place ${n}`;
}
/** All writes complete before UI success. Bound SQL and a transaction enforce the 20-place limit. */
export function placesRepository(db: SQLiteDatabase | null) {
  const requireDb = () => {
    if (!db) throw new AppError("STORAGE_ERROR");
    return db;
  };
  return {
    async load() {
      return requireDb().getAllAsync<SavedPlace>(
        "SELECT id,name,longitude,latitude,created_at AS createdAt,updated_at AS updatedAt FROM places ORDER BY created_at ASC",
      );
    },
    async save(
      name: string,
      coordinates: LonLat,
      id: string | null,
      now: number,
    ) {
      if (!validPlaceName(name) || !validCoordinates(coordinates))
        throw new AppError("INVALID_PLACE");
      let result!: SavedPlace;
      await requireDb().withExclusiveTransactionAsync(async (tx) => {
        const existing = id
          ? await tx.getFirstAsync<{ created_at: number }>(
              "SELECT created_at FROM places WHERE id=?",
              id,
            )
          : null;
        if (id && !existing) throw new AppError("MISSING_PLACE");
        const count = (await tx.getFirstAsync<{ count: number }>(
          "SELECT count(*) AS count FROM places",
        ))!.count;
        if (!existing && count >= 20) throw new AppError("PLACE_LIMIT");
        result = {
          id: id ?? randomUUID(),
          name: name.trim(),
          longitude: coordinates[0],
          latitude: coordinates[1],
          createdAt: existing?.created_at ?? now,
          updatedAt: now,
        };
        await tx.runAsync(
          "INSERT OR REPLACE INTO places(id,name,longitude,latitude,created_at,updated_at) VALUES(?,?,?,?,?,?)",
          result.id,
          result.name,
          result.longitude,
          result.latitude,
          result.createdAt,
          result.updatedAt,
        );
      });
      return result;
    },
    async remove(id: string) {
      await requireDb().runAsync("DELETE FROM places WHERE id=?", id);
    },
  };
}
