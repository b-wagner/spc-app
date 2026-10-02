import { Text, View } from "react-native";
import { categoryInfo } from "@/features/outlooks/categories";
import type { assessPoint } from "@/features/outlooks/validity";
import { styles } from "@/theme/tokens";
/** Text always carries the result; expired/missing data cannot render a current colored badge. */
export function RiskBadge({
  assessment,
  compact = false,
}: {
  assessment: ReturnType<typeof assessPoint>;
  compact?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      {assessment.category && (
        <View
          style={{
            width: 8,
            alignSelf: "stretch",
            minHeight: 24,
            borderRadius: 4,
            backgroundColor: categoryInfo(assessment.category).fill,
            borderWidth: 1,
            borderColor: categoryInfo(assessment.category).outline,
          }}
        />
      )}
      <Text
        numberOfLines={compact ? 1 : undefined}
        selectable
        style={[compact ? styles.body : styles.risk, { flex: 1 }]}
      >
        {assessment.label}
      </Text>
    </View>
  );
}
