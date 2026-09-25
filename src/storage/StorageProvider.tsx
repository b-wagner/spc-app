import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { ActivityIndicator, View, Text } from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { openDatabase } from "./database";
const StorageContext = createContext<{
  db: SQLiteDatabase | null;
  storageNotice: boolean;
  reportStorageFailure: () => void;
} | null>(null);
let opening: Promise<SQLiteDatabase> | undefined;
/** Opens/migrates once before hydration. A failed database degrades weather to memory-only. */
export function StorageProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{
    ready: boolean;
    db: SQLiteDatabase | null;
  }>({ ready: false, db: null });
  const [storageNotice, setNotice] = useState(false);
  const reportStorageFailure = useCallback(() => setNotice(true), []);
  useEffect(() => {
    let alive = true;
    opening ??= openDatabase();
    opening
      .then((db) => {
        if (alive) setState({ ready: true, db });
      })
      .catch(() => {
        if (alive) {
          setState({ ready: true, db: null });
          setNotice(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!state.ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <ActivityIndicator />
        <Text>Opening saved outlooks…</Text>
      </View>
    );
  return (
    <StorageContext
      value={{ db: state.db, storageNotice, reportStorageFailure }}
    >
      {children}
    </StorageContext>
  );
}
/** Shared database and non-blocking persistent-storage notice. */
export function useStorage() {
  const value = use(StorageContext);
  if (!value) throw Error("StorageProvider missing");
  return value;
}
