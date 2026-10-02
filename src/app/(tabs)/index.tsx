import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import OutlookMap from "@/features/map/OutlookMap";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { usePlaces } from "@/features/places/PlacesProvider";
import { useStorage } from "@/storage/StorageProvider";
import { temporalState, statusMessage } from "@/features/outlooks/validity";
import { LocationDeniedError } from "@/features/location/locateOnce";
import { errorCode } from "@/utils/errors";
import { fixtureMode } from "@/utils/clock";
import { StatusBanner } from "@/components/StatusBanner";
import { ForecastDaySelector } from "@/components/ForecastDaySelector";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { OutlookBottomSheet } from "@/components/OutlookBottomSheet";
import { styles } from "@/theme/tokens";
import { isInsideNationalBounds } from "@/features/map/camera";
import { BASEMAP_PROVIDER } from "@/features/map/basemap";
import { ExternalLink } from "@/components/ExternalLink";

export default function MapScreen() {
  const { day, states, now } = useOutlook();
  const { select, usView, locator } = usePlaces();
  const { storageNotice } = useStorage();
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [openSettings, setOpenSettings] = useState(false);
  const locateOperation = useRef(0);
  const state = states[day];

  useEffect(
    () => () => {
      locateOperation.current++;
      locator.cancel();
    },
    [locator],
  );
  const locate = async () => {
    const operation = ++locateOperation.current;
    setLocating(true);
    setLocationMessage(null);
    setOpenSettings(false);
    try {
      const result = await locator.locate();
      if (operation !== locateOperation.current) return;
      if (!isInsideNationalBounds(result.coordinates)) {
        setLocationMessage(
          "Your current location is outside this map’s contiguous U.S. coverage.",
        );
        return;
      }
      select({ ...result, savedPlaceId: null, origin: "device" }, true);
    } catch (error) {
      if (operation !== locateOperation.current) return;
      if (error instanceof LocationDeniedError) {
        setLocationMessage(
          "Location access is off. Search for a place or tap the map instead.",
        );
        setOpenSettings(!error.canAskAgain);
      } else if (errorCode(error) !== "CANCELED") {
        setLocationMessage(
          "Location is unavailable. Search for a place or tap the map instead.",
        );
      }
    } finally {
      if (operation === locateOperation.current) setLocating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBanner
        message={fixtureMode ? "DEMO DATA — NOT CURRENT WEATHER" : null}
      />
      <StatusBanner
        message={
          storageNotice
            ? "Local storage unavailable. Changes may not be saved."
            : null
        }
      />
      <ForecastDaySelector />
      <StatusBanner message={statusMessage(state, day, now)} />
      <View style={{ flex: 1, minHeight: 240 }}>
        <View style={{ backgroundColor: "#FFFFFF" }}>
          <ExternalLink
            label={BASEMAP_PROVIDER.attribution}
            url={BASEMAP_PROVIDER.attributionUrl}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ScreenErrorBoundary map>
            <OutlookMap
              snapshot={state.snapshot}
              expired={temporalState(state.snapshot, now) === "expired"}
            />
          </ScreenErrorBoundary>
          <OutlookBottomSheet
            locating={locating}
            locationMessage={locationMessage}
            openSettings={openSettings}
            onLocate={() => void locate()}
            onDismissLocation={() => setLocationMessage(null)}
            onOpenSettings={() =>
              void Linking.openSettings().catch(() =>
                setLocationMessage("Unable to open device settings."),
              )
            }
            onUsView={usView}
          />
        </View>
      </View>
    </View>
  );
}
