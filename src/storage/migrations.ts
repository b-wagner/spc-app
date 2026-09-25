import type { SQLiteDatabase } from "expo-sqlite";
import { AppError } from "@/utils/errors";
/** Monotonic migrations only. Unknown newer schemas are never reset or downgraded. */
export async function migrate(db: SQLiteDatabase) {
  const version =
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version ?? 0;
  if (version > 1)
    throw new AppError(
      "STORAGE_ERROR",
      "Database schema is newer than this app.",
    );
  if (version === 0)
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`
CREATE TABLE IF NOT EXISTS forecast_cache (day INTEGER PRIMARY KEY CHECK(day IN (1,2,3)), schema_version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, checked_at INTEGER NOT NULL, downloaded_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, name TEXT NOT NULL, longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180), latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY,value_json TEXT NOT NULL);
PRAGMA user_version=1;`);
    });
}
