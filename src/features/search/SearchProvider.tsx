import {
  SQLiteProvider,
  useSQLiteContext,
  type SQLiteDatabase,
} from "expo-sqlite";
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { AppError } from "@/utils/errors";
import { LocalSearchProvider } from "./LocalSearchProvider";
import type { LocationSearchProvider } from "./types";

export const SEARCH_DATA_VERSION = "2025";
export const SEARCH_DATABASE_NAME = `us-locations-${SEARCH_DATA_VERSION}.sqlite`;
const SEARCH_SCHEMA_VERSION = "1";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const searchDatabaseAsset = require("../../../assets/search/us-locations-2025.sqlite");

const unavailableProvider: LocationSearchProvider = {
  async search() {
    throw new AppError("SEARCH_UNAVAILABLE");
  },
};
const ignoreDatabaseOpenError = () => undefined;

const SearchContext = createContext<LocationSearchProvider>(unavailableProvider);

async function validateSearchDatabase(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM search_metadata WHERE key IN ('schema_version', 'data_version')",
  );
  const metadata = new Map(rows.map((row) => [row.key, row.value]));
  if (
    metadata.get("schema_version") !== SEARCH_SCHEMA_VERSION ||
    metadata.get("data_version") !== SEARCH_DATA_VERSION
  )
    throw new AppError("SEARCH_UNAVAILABLE");
}

function ReadySearchDatabase({ onReady, onUnavailable }: {
  onReady: (provider: LocationSearchProvider) => void;
  onUnavailable: () => void;
}) {
  const db = useSQLiteContext();
  useEffect(() => {
    let active = true;
    void validateSearchDatabase(db)
      .then(() => {
        if (active) onReady(new LocalSearchProvider(db));
      })
      .catch(() => {
        if (active) onUnavailable();
      });
    return () => {
      active = false;
    };
  }, [db, onReady, onUnavailable]);
  return null;
}

/** Opens the bundled database independently, so a search failure never blocks the app. */
export function SearchProvider({ children }: PropsWithChildren) {
  const [provider, setProvider] = useState<LocationSearchProvider>(unavailableProvider);
  const callbacks = useMemo(
    () => ({
      onReady: (next: LocationSearchProvider) => setProvider(next),
      onUnavailable: () => setProvider(unavailableProvider),
    }),
    [],
  );
  return (
    <>
      <SQLiteProvider
        databaseName={SEARCH_DATABASE_NAME}
        assetSource={{ assetId: searchDatabaseAsset }}
        onError={ignoreDatabaseOpenError}
      >
        <ReadySearchDatabase {...callbacks} />
      </SQLiteProvider>
      <SearchContext value={provider}>{children}</SearchContext>
    </>
  );
}

export function useLocationSearch() {
  return use(SearchContext);
}
