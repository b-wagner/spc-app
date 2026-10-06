import type { LonLat } from "@/features/outlooks/types";

export interface SearchResult {
  id: string;
  label: string;
  coordinates: LonLat;
}

export interface LocationSearchProvider {
  search(value: string, signal: AbortSignal): Promise<SearchResult[]>;
}

export type ParsedSearchQuery =
  | { kind: "zip"; zip: string }
  | { kind: "city"; city: string; state: string | null };
