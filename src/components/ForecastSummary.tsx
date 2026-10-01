import { router } from "expo-router";
import { Text, View } from "react-native";
import { usePlaces } from "@/features/places/PlacesProvider";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { assessPoint, OUTSIDE_COPY } from "@/features/outlooks/validity";
import { formatCoordinates, formatTime } from "@/utils/format";
import { styles } from "@/theme/tokens";
import { AppButton } from "./AppButton";
import { RiskBadge } from "./RiskBadge";
/** Selected-point summary used in the collapsible map sheet and details panel. */
export function ForecastSummary({ compact = false }: { compact?: boolean }) {
  const { selection, places } = usePlaces(),
    { day, states, now } = useOutlook();
  const snapshot = states[day].snapshot;
  const place = places.find((p) => p.id === selection?.savedPlaceId);
  const assessment = selection
    ? assessPoint(snapshot, selection.coordinates, now)
    : null;
  if (compact)
    return (
      <View style={{ gap: 4, flex: 1 }}>
        <Text numberOfLines={1} style={styles.body}>
          {selection
            ? place?.name ?? selection.label ?? "Selected point"
            : "Tap the map to inspect a place"}
        </Text>
        {selection ? (
          <RiskBadge assessment={assessment!} compact />
        ) : (
          <Text style={styles.secondary}>Pull up for search and details</Text>
        )}
      </View>
    );
  return (
    <View style={styles.card}>
      {selection ? (
        <>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text selectable style={styles.body}>
                {place?.name ?? selection.label ?? "Selected point"}
              </Text>
              <Text selectable style={styles.secondary}>
                {formatCoordinates(selection.coordinates)}
                {selection.approximate ? " · Approximate location" : ""}
              </Text>
            </View>
            <AppButton
              label={place ? "Edit place" : "Save place"}
              onPress={() =>
                router.push(
                  place
                    ? { pathname: "/place-edit", params: { id: place.id } }
                    : "/place-edit",
                )
              }
            />
          </View>
          <RiskBadge assessment={assessment!} />
          {assessment?.state === "upcoming" && (
            <Text style={styles.secondary}>
              Forecast for an upcoming period
            </Text>
          )}
          {assessment?.state !== "unavailable" &&
            assessment?.state !== "expired" &&
            !assessment?.category && (
              <Text style={styles.secondary}>{OUTSIDE_COPY}</Text>
            )}
        </>
      ) : (
        <Text style={styles.body}>Tap the map to inspect a place.</Text>
      )}
      {snapshot?.kind === "forecast" && (
        <Text selectable style={styles.secondary}>
          Valid {formatTime(snapshot.validFrom)} –{" "}
          {formatTime(snapshot.expiresAt)}
        </Text>
      )}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={styles.secondary}>Forecast: NOAA/NWS SPC</Text>
        <AppButton
          label="Details"
          onPress={() =>
            router.push({ pathname: "/outlook-details", params: { day } })
          }
        />
      </View>
    </View>
  );
}
