import { DemoBanner } from "@/components/DemoBanner";
import { ScrollView, Text, View } from "react-native";
import { CATEGORIES, categoryLabel } from "@/features/outlooks/categories";
import { styles } from "@/theme/tokens";
export default function Legend() {
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <DemoBanner />
      <Text style={styles.body}>
        Categories summarize the SPC severe-weather outlook for a forecast
        period. They do not describe a current warning or guarantee conditions
        at an exact address.
      </Text>
      {CATEGORIES.map((c) => (
        <View
          key={c.code}
          style={[styles.card, { borderLeftWidth: 8, borderLeftColor: c.fill }]}
        >
          <Text selectable style={styles.risk}>
            {categoryLabel(c.code)}
          </Text>
          <Text style={styles.secondary}>
            {c.code}
            {c.code === "TSTM"
              ? " · Separate from the five severe-risk levels"
              : ""}
          </Text>
        </View>
      ))}
      <Text style={styles.secondary}>
        Boundaries are approximate. Where categories overlap or share a
        boundary, the higher category is shown. No distance buffer is added.
      </Text>
    </ScrollView>
  );
}
