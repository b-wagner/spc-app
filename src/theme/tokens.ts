import { StyleSheet } from "react-native";
export const colors = {
  background: "#F3F5F7",
  surface: "#FFFFFF",
  text: "#17202A",
  secondaryText: "#52606D",
  border: "#D6DEE6",
  accent: "#2457A7",
  warningBackground: "#FFF3CD",
  errorText: "#A61B1B",
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  secondary: { fontSize: 14, color: colors.secondaryText, lineHeight: 20 },
  title: { fontSize: 22, fontWeight: "600", color: colors.text },
  risk: { fontSize: 20, fontWeight: "600", color: colors.text },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  content: { padding: 16, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  link: { color: colors.accent, fontSize: 16 },
});
