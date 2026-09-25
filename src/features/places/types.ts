import type { LonLat } from "@/features/outlooks/types";
/** Local-only record. Timestamps are UTC epoch milliseconds; IDs never go to providers. */
export interface SavedPlace {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  createdAt: number;
  updatedAt: number;
}
export interface Selection {
  coordinates: LonLat;
  savedPlaceId: string | null;
  origin: "map" | "place" | "device";
  approximate?: boolean;
}
