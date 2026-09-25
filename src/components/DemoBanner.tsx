import { StatusBanner } from "./StatusBanner";
import { fixtureMode } from "@/utils/clock";
/** Keep historical demo data identifiable on every screen. */
export function DemoBanner() {
  return (
    <StatusBanner
      message={fixtureMode ? "DEMO DATA — NOT CURRENT WEATHER" : null}
    />
  );
}
