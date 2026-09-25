jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
import type { SQLiteDatabase } from "expo-sqlite";
import { forecastStore } from "@/storage/database";
import { migrate } from "@/storage/migrations";
import { normalizeOutlook } from "@/features/outlooks/normalize";
import { allCategories } from "./fixtures/synthetic";
import { FIXTURE_TIME } from "@/utils/clock";
import { placesRepository } from "@/features/places/repository";
/** These adapters isolate native SQLite. Native restart persistence is tested separately. */
function database(overrides: Partial<SQLiteDatabase> = {}) {
  const db: Record<string, unknown> = {
    getFirstAsync: jest.fn(async () => ({ user_version: 1 })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
    execAsync: jest.fn(async () => {}),
    withExclusiveTransactionAsync: jest.fn(
      async (fn: (db: SQLiteDatabase) => Promise<void>): Promise<void> =>
        fn(db as unknown as SQLiteDatabase),
    ),
    ...overrides,
  };
  return db as unknown as SQLiteDatabase;
}
test("newer migration schema errors without reset", async () => {
  const db = database({
    getFirstAsync: jest.fn(async () => ({
      user_version: 2,
    })) as SQLiteDatabase["getFirstAsync"],
  });
  await expect(migrate(db)).rejects.toThrow("Database schema is newer");
  expect(db.execAsync).not.toHaveBeenCalled();
  expect(db.runAsync).not.toHaveBeenCalled();
});
test("initial migration runs atomically once; up-to-date is untouched", async () => {
  const db = database({
    getFirstAsync: jest.fn(async () => ({
      user_version: 0,
    })) as SQLiteDatabase["getFirstAsync"],
  });
  await migrate(db);
  expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  expect(db.execAsync).toHaveBeenCalledWith(
    expect.stringContaining("PRAGMA user_version=1"),
  );
  const ready = database();
  await migrate(ready);
  expect(ready.withExclusiveTransactionAsync).not.toHaveBeenCalled();
});
test("corrupt forecast deletes only its weather row and preserves valid days", async () => {
  const s = normalizeOutlook(allCategories, 2, FIXTURE_TIME);
  const db = database({
    getAllAsync: jest.fn(async () => [
      { day: 1, schema_version: 1, snapshot_json: "broken" },
      { day: 2, schema_version: 1, snapshot_json: JSON.stringify(s) },
    ]) as SQLiteDatabase["getAllAsync"],
  });
  const cache = await forecastStore(db, { now: () => FIXTURE_TIME }).load();
  expect(cache[2]).toEqual(s);
  expect(db.runAsync).toHaveBeenCalledTimes(1);
  expect(db.runAsync).toHaveBeenCalledWith(
    "DELETE FROM forecast_cache WHERE day=?",
    1,
  );
});
test("48h historical retention purges old forecasts", async () => {
  const s = normalizeOutlook(allCategories, 1, FIXTURE_TIME);
  const db = database({
    getAllAsync: jest.fn(async () => [
      { day: 1, schema_version: 1, snapshot_json: JSON.stringify(s) },
    ]) as SQLiteDatabase["getAllAsync"],
  });
  expect(
    await forecastStore(db, {
      now: () => s.expiresAt! + 48 * 3600000 + 1,
    }).load(),
  ).toEqual({});
});
test("clear does not touch places or preferences", async () => {
  const db = database();
  await forecastStore(db, { now: () => FIXTURE_TIME }).clear();
  expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM forecast_cache");
  expect(db.runAsync).toHaveBeenCalledTimes(1);
});
test("place write failure rejects instead of returning an unsaved record", async () => {
  const db = database({
    getFirstAsync: jest.fn(async () => ({
      count: 0,
    })) as SQLiteDatabase["getFirstAsync"],
    runAsync: jest.fn(async () => {
      throw Error("disk full");
    }),
  });
  await expect(
    placesRepository(db).save("Home", [-99, 38], null, FIXTURE_TIME),
  ).rejects.toThrow("disk full");
});
test("place count enforced in the write transaction, edits remain allowed", async () => {
  const db = database({
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes("count") ? { count: 20 } : { created_at: 1 },
    ) as SQLiteDatabase["getFirstAsync"],
  });
  await expect(
    placesRepository(db).save("New", [-99, 38], null, FIXTURE_TIME),
  ).rejects.toThrow("PLACE_LIMIT");
  const saved = await placesRepository(db).save(
    "Renamed",
    [-99, 38],
    "existing",
    FIXTURE_TIME,
  );
  expect(saved.createdAt).toBe(1);
  expect(db.runAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT OR REPLACE INTO places"),
    "existing",
    "Renamed",
    -99,
    38,
    1,
    FIXTURE_TIME,
  );
});
