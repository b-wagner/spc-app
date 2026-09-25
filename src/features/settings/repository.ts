import type { SQLiteDatabase } from "expo-sqlite";
import type { LonLat } from "@/features/outlooks/types";
import { isRecord, validCoordinates } from "@/features/outlooks/normalize";
export interface SavedCamera {
  center: LonLat;
  zoom: number;
}
/** Preferences are validated independently; a malformed camera never invents a selected point. */
export function settingsRepository(db: SQLiteDatabase | null) {
  return {
    async load() {
      let camera: SavedCamera | null = null,
        selectedPlaceId: string | null = null;
      if (!db) return { camera, selectedPlaceId };
      for (const row of await db.getAllAsync<{
        key: string;
        value_json: string;
      }>("SELECT * FROM preferences"))
        try {
          const value: unknown = JSON.parse(row.value_json);
          if (
            row.key === "camera" &&
            isRecord(value) &&
            validCoordinates(value.center) &&
            typeof value.zoom === "number" &&
            Number.isFinite(value.zoom)
          )
            camera = {
              center: [value.center[0], value.center[1]],
              zoom: Math.max(2, Math.min(10, value.zoom)),
            };
          if (row.key === "selectedPlaceId" && typeof value === "string")
            selectedPlaceId = value;
        } catch {
          /* Invalid optional preference is ignored without resetting user data. */
        }
      return { camera, selectedPlaceId };
    },
    async set(
      key: "camera" | "selectedPlaceId",
      value: SavedCamera | string | null,
    ) {
      if (db)
        await db.runAsync(
          "INSERT OR REPLACE INTO preferences(key,value_json) VALUES(?,?)",
          key,
          JSON.stringify(value),
        );
    },
  };
}
