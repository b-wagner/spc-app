import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors } from "@/theme/tokens";
/** Minimum 48-point target; all actions remain text-labeled at large font sizes. */
export function AppButton({
  label,
  onPress,
  disabled = false,
  pending = false,
  destructive = false,
  selected = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  destructive?: boolean;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: disabled || pending,
        busy: pending,
        selected,
      }}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: 12,
        paddingVertical: compact ? 0 : 10,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
        borderRadius: 8,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed
          ? "#DDE7F7"
          : selected
            ? "#E4EDF9"
            : "transparent",
      })}
    >
      {pending && <ActivityIndicator size="small" />}
      <Text
        maxFontSizeMultiplier={compact ? 2 : undefined}
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: destructive ? colors.errorText : colors.accent,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
