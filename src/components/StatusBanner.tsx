import { Text, View } from "react-native";
import { colors, styles } from "@/theme/tokens";
export function StatusBanner({ message }: { message: string | null }) {
  return message ? (
    <View style={{ backgroundColor: colors.warningBackground, padding: 10 }}>
      <Text selectable style={styles.secondary}>
        {message}
      </Text>
    </View>
  ) : null;
}
