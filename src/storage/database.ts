/** SQLite is initialized once, before providers hydrate. Failures never erase the database. */
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { migrate } from "./migrations";
import {
  DAYS,
  type OutlookDay,
  type OutlookSnapshot,
} from "@/features/outlooks/types";
import { validateCachedSnapshot } from "@/features/outlooks/normalize";
import type { ForecastStore } from "@/features/outlooks/repository";
import type { Clock } from "@/utils/clock";
import { AppError } from "@/utils/errors";
export async function openDatabase() {
  const db = await openDatabaseAsync("spc-outlook.db");
  await migrate(db);
  return db;
}
/** Invalid/old weather rows are removed individually, never affecting places or preferences. */
export function forecastStore(
  db: SQLiteDatabase | null,
  clock: Clock,
): ForecastStore {
  const requireDb = () => {
    if (!db) throw new AppError("STORAGE_ERROR");
    return db;
  };
  return {
    async load() {
      const result: Partial<Record<OutlookDay, OutlookSnapshot>> = {};
      const rows = await requireDb().getAllAsync<{
        day: OutlookDay;
        schema_version: number;
        snapshot_json: string;
      }>("SELECT * FROM forecast_cache");
      for (const row of rows) {
        try {
          if (!DAYS.includes(row.day) || row.schema_version !== 1)
            throw new AppError("INVALID_CACHE");
          const snapshot = validateCachedSnapshot(
            JSON.parse(row.snapshot_json),
            row.day,
          );
          if (
            clock.now() - (snapshot.expiresAt ?? snapshot.checkedAt) >
            48 * 3600000
          )
            throw new AppError("EXPIRED_CACHE");
          result[row.day] = snapshot;
        } catch {
          await requireDb().runAsync(
            "DELETE FROM forecast_cache WHERE day=?",
            row.day,
          );
        }
      }
      return result;
    },
    async put(snapshot) {
      await requireDb().withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
          "INSERT OR REPLACE INTO forecast_cache(day,schema_version,snapshot_json,checked_at,downloaded_at) VALUES(?,?,?,?,?)",
          snapshot.day,
          1,
          JSON.stringify(snapshot),
          snapshot.checkedAt,
          snapshot.downloadedAt,
        );
      });
    },
    async remove(day) {
      await requireDb().runAsync("DELETE FROM forecast_cache WHERE day=?", day);
    },
    async clear() {
      await requireDb().runAsync("DELETE FROM forecast_cache");
    },
  };
}
