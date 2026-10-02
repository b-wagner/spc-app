import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { checkedLabel } from "@/utils/format";
import { colors, styles } from "@/theme/tokens";
import { AppButton } from "./AppButton";
import { ForecastSummary } from "./ForecastSummary";
import { LocationSearch } from "./LocationSearch";
import { StatusBanner } from "./StatusBanner";

/** Collapsible map overlay that keeps controls and detail content off the main canvas. */
export function OutlookBottomSheet({
  locating,
  locationMessage,
  openSettings,
  onLocate,
  onDismissLocation,
  onOpenSettings,
  onUsView,
}: {
  locating: boolean;
  locationMessage: string | null;
  openSettings: boolean;
  onLocate: () => void;
  onDismissLocation: () => void;
  onOpenSettings: () => void;
  onUsView: () => void;
}) {
  const [userExpanded, setUserExpanded] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const outlook = useOutlook();
  const state = outlook.states[outlook.day];
  const pending = ["loading", "refreshing"].includes(state.network);
  const expanded = userExpanded || Boolean(locationMessage);
  const sheetHeight = Math.min(
    Math.max(240, availableHeight - 8),
    height * (fontScale > 1.3 ? 0.82 : 0.7),
    Math.max(360, height - 120),
  );
  const collapsedHeight = fontScale > 1.3 ? 160 : 132;
  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => setAvailableHeight(event.nativeEvent.layout.height)}
      style={{ position: "absolute", inset: 0 }}
    >
      <View
        accessibilityViewIsModal={expanded}
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: Math.max(8, insets.bottom),
        height: expanded ? sheetHeight : collapsedHeight,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        shadowColor: "#000000",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 8,
        overflow: "hidden",
        }}
      >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? "Collapse outlook panel" : "Expand outlook panel"
        }
        accessibilityState={{ expanded }}
        onPress={() => {
          if (expanded && locationMessage) onDismissLocation();
          setUserExpanded(!expanded);
        }}
        style={({ pressed }) => ({
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? "#EEF3FA" : colors.surface,
        })}
      >
        <View
          style={{
            width: 44,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.border,
          }}
        />
        <Text style={styles.secondary}>
          {expanded ? "Hide controls" : "Search and outlook details"}
        </Text>
      </Pressable>
      {!expanded ? (
        <View
          style={[
            styles.row,
            { flex: 1, paddingHorizontal: 12, flexWrap: "nowrap" },
          ]}
        >
          <ForecastSummary compact />
          <AppButton
            label="Locate me"
            compact
            pending={locating}
            onPress={onLocate}
          />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 12 }}
        >
          <LocationSearch />
          <View style={[styles.row, { justifyContent: "space-around" }]}>
            <AppButton
              label="Locate me"
              pending={locating}
              onPress={onLocate}
            />
            <AppButton label="US view" onPress={onUsView} />
            <AppButton label="Legend" onPress={() => router.push("/legend")} />
          </View>
          <StatusBanner message={locationMessage} />
          {openSettings && (
            <AppButton label="Open settings" onPress={onOpenSettings} />
          )}
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Text selectable style={styles.secondary}>
              {checkedLabel(state.snapshot?.checkedAt, outlook.now)}
            </Text>
            <AppButton
              label="Refresh"
              pending={pending}
              disabled={outlook.now < outlook.deadline}
              onPress={outlook.refresh}
            />
          </View>
          {outlook.now < outlook.deadline && !pending && (
            <Text style={styles.secondary}>
              Try again in{" "}
              {Math.max(
                1,
                Math.ceil((outlook.deadline - outlook.now) / 60000),
              )}{" "}
              min
            </Text>
          )}
          <ForecastSummary />
        </ScrollView>
      )}
      </View>
    </View>
  );
}
