import { Pressable, Text, View } from "react-native";
import { DAYS } from "@/features/outlooks/types";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { colors, styles } from "@/theme/tokens";
/** Dates come only from the product valid start, never from device today + day number. */
export function ForecastDaySelector() {
  const { day, setDay, states } = useOutlook();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        paddingHorizontal: 8,
      }}
    >
      {DAYS.map((d) => {
        const time = states[d].snapshot?.validFrom;
        const date = time
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
            }).format(time)
          : null;
        return (
          <Pressable
            key={d}
            accessibilityRole="tab"
            accessibilityLabel={`Day ${d}${date ? `, ${date}` : ""}`}
            accessibilityState={{ selected: day === d }}
            onPress={() => setDay(d)}
            style={{
              flex: 1,
              minHeight: 56,
              padding: 8,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderBottomWidth: 3,
              borderBottomColor: day === d ? colors.accent : "transparent",
            }}
          >
            <Text
              style={[
                styles.body,
                {
                  fontWeight: "600",
                  color: day === d ? colors.accent : colors.secondaryText,
                },
              ]}
            >
              Day {d}
            </Text>
            {date && <Text style={styles.secondary}>{date}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
