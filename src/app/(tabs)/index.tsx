import { useEffect, useState } from "react";
import {
  Linking,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import OutlookMap from "@/features/map/OutlookMap";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { usePlaces } from "@/features/places/PlacesProvider";
import { useStorage } from "@/storage/StorageProvider";
import { temporalState, statusMessage } from "@/features/outlooks/validity";
import { LocationDeniedError } from "@/features/location/locateOnce";
import { errorCode } from "@/utils/errors";
import { fixtureMode } from "@/utils/clock";
import { checkedLabel } from "@/utils/format";
import { AppButton } from "@/components/AppButton";
import { StatusBanner } from "@/components/StatusBanner";
import { ForecastDaySelector } from "@/components/ForecastDaySelector";
import { ForecastSummary } from "@/components/ForecastSummary";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { styles } from "@/theme/tokens";
export default function MapScreen() {
  const { day, states, now, refresh, deadline } = useOutlook(),
    { select, usView, locator } = usePlaces(),
    { storageNotice } = useStorage();
  const [locating, setLocating] = useState(false),
    [locationMessage, setLocationMessage] = useState<string | null>(null),
    [openSettings, setOpenSettings] = useState(false);
  const { height, fontScale } = useWindowDimensions();
  const state = states[day],
    pending = ["loading", "refreshing"].includes(state.network);
  useEffect(() => () => locator.cancel(), [locator]);
  const locate = async () => {
    setLocating(true);
    setLocationMessage(null);
    setOpenSettings(false);
    try {
      const result = await locator.locate();
      select({ ...result, savedPlaceId: null, origin: "device" }, true);
    } catch (e) {
      if (e instanceof LocationDeniedError) {
        setLocationMessage(
          "Location access is off. You can still tap the map.",
        );
        setOpenSettings(!e.canAskAgain);
      } else if (errorCode(e) !== "CANCELED")
        setLocationMessage("Location unavailable. You can still tap the map.");
    } finally {
      setLocating(false);
    }
  };
  const large = fontScale > 1.3 || height < 700;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ flexGrow: 1 }}
      scrollEnabled={large}
    >
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
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: 12,
            justifyContent: "space-between",
            backgroundColor: "white",
          },
        ]}
      >
        <Text selectable style={styles.secondary}>
          {checkedLabel(state.snapshot?.checkedAt, now)}
        </Text>
        <AppButton
          label="Refresh"
          onPress={refresh}
          pending={pending}
          disabled={now < deadline}
        />
      </View>
      {now < deadline && !pending && (
        <Text style={[styles.secondary, { paddingHorizontal: 16 }]}>
          Try again in {Math.max(1, Math.ceil((deadline - now) / 60000))} min
        </Text>
      )}
      <StatusBanner message={statusMessage(state, day, now)} />
      <View style={large ? { height: 300 } : { flex: 1, minHeight: 200 }}>
        <ScreenErrorBoundary map>
          <OutlookMap
            snapshot={state.snapshot}
            expired={temporalState(state.snapshot, now) === "expired"}
          />
        </ScreenErrorBoundary>
      </View>
      <View
        style={[
          styles.row,
          { justifyContent: "space-around", backgroundColor: "white" },
        ]}
      >
        <AppButton
          label="Locate me"
          pending={locating}
          onPress={() => void locate()}
        />
        <AppButton label="US view" onPress={usView} />
        <AppButton label="Legend" onPress={() => router.push("/legend")} />
      </View>
      <StatusBanner message={locationMessage} />
      {openSettings && (
        <AppButton
          label="Open settings"
          onPress={() =>
            void Linking.openSettings().catch(() =>
              setLocationMessage("Unable to open device settings."),
            )
          }
        />
      )}
      <View style={{ padding: 12 }}>
        <ForecastSummary />
      </View>
    </ScrollView>
  );
}
