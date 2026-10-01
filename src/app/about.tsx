import { DemoBanner } from "@/components/DemoBanner";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { BASEMAP_PROVIDER } from "@/features/map/basemap";
import { spcUrl } from "@/features/outlooks/sourceConfig";
import { fixtureMode, FIXTURE_TIME } from "@/utils/clock";
import { styles } from "@/theme/tokens";
import { AppButton } from "@/components/AppButton";
import { ExternalLink } from "@/components/ExternalLink";
export default function About() {
  const { clear } = useOutlook(),
    [pending, setPending] = useState(false);
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <DemoBanner />
      <View style={styles.card}>
        <Text style={styles.title}>SPC Outlook</Text>
        <Text style={styles.secondary}>
          Version 0.2.0{__DEV__ ? " · Development build" : ""}
        </Text>
        <Text style={styles.body}>
          Independent viewer of NOAA/NWS Storm Prediction Center outlooks. Not
          affiliated with or endorsed by NOAA.
        </Text>
        <Text style={styles.body}>
          This app displays outlooks and does not provide emergency warnings.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Your data</Text>
        <Text style={styles.body}>
          Saved places stay on this device. Location is optional. Map and data
          providers receive ordinary network requests.
        </Text>
        <Text style={styles.secondary}>
          Map tile requests reveal the area being viewed. Selected coordinates
          and place names are not sent to NOAA; point inspection happens on this
          device. Search terms are sent to the configured OpenStreetMap search
          provider only when you submit a search. No accounts, analytics, or
          background location tracking.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Forecasts and maps</Text>
        <Text style={styles.body}>
          Outlooks cover the contiguous US. Forecasts are cached with their
          original issue and valid times. Expired forecasts are reference maps
          only.
        </Text>
        <Text style={styles.secondary}>
          The background map has a separate native tile cache. Areas you have
          not viewed may be missing offline. Clearing forecasts preserves saved
          places and map tiles. Forecast Discussions are loaded on demand from
          the official SPC plain-text products and shown only when their issue
          and validity times match the displayed outlook.
        </Text>
        <ExternalLink
          label="NOAA/NWS Storm Prediction Center"
          url={spcUrl(1)}
        />
        <ExternalLink
          label={BASEMAP_PROVIDER.attribution}
          url={BASEMAP_PROVIDER.attributionUrl}
        />
        <AppButton
          label="Clear cached forecasts"
          pending={pending}
          destructive
          onPress={() =>
            Alert.alert(
              "Clear cached forecasts?",
              "Saved places and map tiles will remain. The app will check for outlooks again.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: () => {
                    setPending(true);
                    void clear()
                      .catch(() =>
                        Alert.alert(
                          "Could not clear saved forecasts",
                          "Local storage is unavailable. In-memory forecasts were cleared.",
                        ),
                      )
                      .finally(() => setPending(false));
                  },
                },
              ],
            )
          }
        />
      </View>
      {fixtureMode && (
        <View style={styles.card}>
          <Text style={styles.body}>DEMO DATA — NOT CURRENT WEATHER</Text>
          <Text style={styles.secondary}>
            Reference clock: {new Date(FIXTURE_TIME).toISOString()}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
