import type { SQLiteDatabase } from "expo-sqlite";
import { AppError } from "@/utils/errors";
import { parseSearchQuery } from "./normalize";
import { findPlaces, findZip } from "./repository";
import type { LocationSearchProvider, SearchResult } from "./types";

/** Production provider backed by the versioned, bundled Census database. */
export class LocalSearchProvider implements LocationSearchProvider {
  constructor(private readonly db: SQLiteDatabase) {}

  async search(value: string, signal: AbortSignal): Promise<SearchResult[]> {
    if (signal.aborted) throw new AppError("CANCELED");
    const query = parseSearchQuery(value);
    const results =
      query.kind === "zip"
        ? await findZip(this.db, query.zip)
        : await findPlaces(this.db, query.city, query.state);
    if (signal.aborted) throw new AppError("CANCELED");
    return results;
  }
}
