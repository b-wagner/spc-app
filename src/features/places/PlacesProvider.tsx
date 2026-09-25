import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useStorage } from "@/storage/StorageProvider";
import { placesRepository } from "./repository";
import {
  settingsRepository,
  type SavedCamera,
} from "@/features/settings/repository";
import { OneShotLocation } from "@/features/location/locateOnce";
import type { LonLat } from "@/features/outlooks/types";
import type { SavedPlace, Selection } from "./types";
interface PlacesContextValue {
  places: SavedPlace[];
  selection: Selection | null;
  initialCamera: SavedCamera | null;
  cameraRequest: { id: number; camera: SavedCamera | null } | null;
  select: (selection: Selection, center?: boolean) => void;
  usView: () => void;
  save: (name: string, coordinates: LonLat, id: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  rememberCamera: (camera: SavedCamera) => void;
  locator: OneShotLocation;
}
const PlacesContext = createContext<PlacesContextValue | null>(null);
/** Persisted places and ephemeral selection. GPS fixes are never stored as place records. */
export function PlacesProvider({ children }: PropsWithChildren) {
  const { db, reportStorageFailure } = useStorage();
  const repository = useMemo(() => placesRepository(db), [db]),
    settings = useMemo(() => settingsRepository(db), [db]);
  const [places, setPlaces] = useState<SavedPlace[]>([]),
    [selection, setSelection] = useState<Selection | null>(null),
    [ready, setReady] = useState(false);
  const [initialCamera, setInitialCamera] = useState<SavedCamera | null>(null),
    [cameraRequest, setCameraRequest] =
      useState<PlacesContextValue["cameraRequest"]>(null);
  const [locator] = useState(() => new OneShotLocation());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const preferenceTail = useRef(Promise.resolve());
  const persistPreference = useCallback(
    (key: "camera" | "selectedPlaceId", value: SavedCamera | string | null) => {
      preferenceTail.current = preferenceTail.current
        .then(() => settings.set(key, value))
        .catch(() => reportStorageFailure());
    },
    [settings, reportStorageFailure],
  );
  useEffect(() => {
    let alive = true;
    void Promise.all([
      repository.load().catch(() => {
        reportStorageFailure();
        return [] as SavedPlace[];
      }),
      settings.load().catch(() => {
        reportStorageFailure();
        return { camera: null, selectedPlaceId: null };
      }),
    ]).then(([saved, prefs]) => {
      if (!alive) return;
      setPlaces(saved);
      const selected = saved.find((p) => p.id === prefs.selectedPlaceId);
      if (selected) {
        setSelection({
          coordinates: [selected.longitude, selected.latitude],
          savedPlaceId: selected.id,
          origin: "place",
        });
        setInitialCamera({
          center: [selected.longitude, selected.latitude],
          zoom: 7,
        });
      } else {
        setInitialCamera(prefs.camera);
        if (prefs.selectedPlaceId) persistPreference("selectedPlaceId", null);
      }
      setReady(true);
    });
    return () => {
      alive = false;
      clearTimeout(timer.current);
      locator.cancel();
    };
  }, [repository, settings, locator, persistPreference, reportStorageFailure]);
  const select = useCallback(
    (next: Selection, center = false) => {
      locator.cancel();
      setSelection(next);
      persistPreference("selectedPlaceId", next.savedPlaceId);
      if (center)
        setCameraRequest({
          id: Date.now(),
          camera: { center: next.coordinates, zoom: 7 },
        });
    },
    [locator, persistPreference],
  );
  const save = async (name: string, coordinates: LonLat, id: string | null) => {
    try {
      const place = await repository.save(name, coordinates, id, Date.now());
      setPlaces((old) =>
        [...old.filter((p) => p.id !== place.id), place].sort(
          (a, b) => a.createdAt - b.createdAt,
        ),
      );
      select({
        coordinates: [place.longitude, place.latitude],
        savedPlaceId: place.id,
        origin: "place",
      });
    } catch (e) {
      reportStorageFailure();
      throw e;
    }
  };
  const remove = async (id: string) => {
    try {
      await repository.remove(id);
      setPlaces((old) => old.filter((p) => p.id !== id));
      if (selection?.savedPlaceId === id)
        select({ ...selection, savedPlaceId: null, origin: "map" });
    } catch (e) {
      reportStorageFailure();
      throw e;
    }
  };
  const rememberCamera = useCallback(
    (camera: SavedCamera) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(
        () => persistPreference("camera", camera),
        500,
      );
    },
    [persistPreference],
  );
  return (
    <PlacesContext
      value={{
        places,
        selection,
        initialCamera,
        cameraRequest,
        select,
        save,
        remove,
        rememberCamera,
        locator,
        usView: () => setCameraRequest({ id: Date.now(), camera: null }),
      }}
    >
      {ready ? children : null}
    </PlacesContext>
  );
}
/** Selection survives forecast-day changes and deleting a place retains its unsaved point. */
export function usePlaces() {
  const value = use(PlacesContext);
  if (!value) throw Error("PlacesProvider missing");
  return value;
}
