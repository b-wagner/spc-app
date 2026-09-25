import {
  createContext,
  use,
  useEffect,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { appClock, fixtureMode } from "@/utils/clock";
import { useStorage } from "@/storage/StorageProvider";
import { forecastStore } from "@/storage/database";
import { fetchOutlook } from "./client";
import { fixtureFetcher } from "./fixtures";
import { OutlookScheduler } from "./scheduler";
import { DAYS, type OutlookDay, type OutlookStates } from "./types";
interface ContextValue {
  day: OutlookDay;
  setDay: (day: OutlookDay) => void;
  states: OutlookStates;
  now: number;
  refresh: () => void;
  deadline: number;
  clear: () => Promise<void>;
}
const OutlookContext = createContext<ContextValue | null>(null);
/** Owns the one foreground timer/subscription, starting only after durable hydration. */
export function OutlookProvider({ children }: PropsWithChildren) {
  const { db, reportStorageFailure } = useStorage();
  const [scheduler] = useState(
    () =>
      new OutlookScheduler(
        appClock,
        fixtureMode
          ? fixtureFetcher
          : (day, cached, signal) =>
              fetchOutlook(day, cached, signal, appClock),
        fixtureMode
          ? {
              load: async () => ({}),
              put: async () => {},
              remove: async () => {},
              clear: async () => {},
            }
          : forecastStore(db, appClock),
        reportStorageFailure,
      ),
  );
  const [day, setDayState] = useState<OutlookDay>(1);
  const dayRef = useRef(day);
  const [, redraw] = useReducer((n) => n + 1, 0);
  const [now, setNow] = useState(appClock.now());
  const [ready, setReady] = useState(false);
  useEffect(() => scheduler.subscribe(redraw), [scheduler]);
  useEffect(() => {
    let alive = true,
      timer: ReturnType<typeof setInterval> | undefined,
      hydrated = false;
    const tick = () => {
      setNow(appClock.now());
      void scheduler.enqueue(dayRef.current, false, true);
      for (const d of DAYS) if (d !== dayRef.current) void scheduler.enqueue(d);
    };
    const activate = () => {
      clearInterval(timer);
      const active = AppState.currentState === "active";
      scheduler.setActive(active);
      if (active && hydrated) {
        tick();
        timer = setInterval(tick, 60000);
      }
    };
    const subscription = AppState.addEventListener("change", activate);
    void scheduler.hydrate().then(async () => {
      if (!alive) return;
      hydrated = true;
      setReady(true);
      scheduler.setActive(AppState.currentState === "active");
      await scheduler.enqueue(1);
      if (!alive) return;
      activate();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
      scheduler.setActive(false);
    };
  }, [scheduler]);
  const setDay = (next: OutlookDay) => {
    dayRef.current = next;
    setDayState(next);
    setNow(appClock.now());
    void scheduler.enqueue(next, false, true);
  };
  const clear = async () => {
    await scheduler.clear();
    await scheduler.enqueue(dayRef.current);
    for (const d of DAYS) if (d !== dayRef.current) void scheduler.enqueue(d);
  };
  return (
    <OutlookContext
      value={{
        day,
        setDay,
        states: scheduler.states,
        now,
        refresh: () => {
          setNow(appClock.now());
          void scheduler.enqueue(day, true, true);
        },
        deadline: scheduler.deadline(day, true),
        clear,
      }}
    >
      {ready ? children : null}
    </OutlookContext>
  );
}
/** Immutable per-day data and separate network state, shared by map and all place rows. */
export function useOutlook() {
  const value = use(OutlookContext);
  if (!value) throw Error("OutlookProvider missing");
  return value;
}
