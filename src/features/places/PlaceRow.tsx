import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import type { SavedPlace } from "./types";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { assessPoint, statusMessage } from "@/features/outlooks/validity";
import { formatCoordinates, checkedLabel, formatTime } from "@/utils/format";
import { AppButton } from "@/components/AppButton";
import { styles } from "@/theme/tokens";
/** All rows inspect the same in-memory Day 1 snapshot; rows never fetch. */
export function PlaceRow({
  place,
  onSelect,
  onDelete,
}: {
  place: SavedPlace;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { states, now } = useOutlook(),
    state = states[1],
    p = [place.longitude, place.latitude] as const,
    assessment = assessPoint(state.snapshot, p, now);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show ${place.name} on map. Day 1: ${assessment.label}`}
        onPress={onSelect}
        style={{ minHeight: 48, gap: 6 }}
      >
        <Text selectable style={styles.title}>
          {place.name}
        </Text>
        <Text style={styles.secondary}>{formatCoordinates(p)}</Text>
        <Text style={styles.body}>Day 1 · {assessment.label}</Text>
        <Text style={styles.secondary}>
          {checkedLabel(state.snapshot?.checkedAt, now)}
        </Text>
        {state.snapshot?.kind === "forecast" && (
          <Text style={styles.secondary}>
            Valid {formatTime(state.snapshot.validFrom)} –{" "}
            {formatTime(state.snapshot.expiresAt)}
          </Text>
        )}
        {statusMessage(state, 1, now) && (
          <Text style={styles.secondary}>{statusMessage(state, 1, now)}</Text>
        )}
      </Pressable>
      <View style={styles.row}>
        <AppButton
          label={`Edit ${place.name}`}
          onPress={() =>
            router.push({ pathname: "/place-edit", params: { id: place.id } })
          }
        />
        <AppButton
          label={`Delete ${place.name}`}
          destructive
          onPress={onDelete}
        />
      </View>
    </View>
  );
}
