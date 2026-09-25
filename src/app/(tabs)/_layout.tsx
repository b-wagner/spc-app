import { Tabs, router } from "expo-router";
import { AppButton } from "@/components/AppButton";
import { colors } from "@/theme/tokens";
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAllowFontScaling: false,
        tabBarActiveTintColor: colors.accent,
        tabBarLabelStyle: { fontSize: 14 },
        tabBarIconStyle: { display: "none" },
        tabBarItemStyle: { paddingVertical: 8 },
        headerTitleStyle: { fontSize: 22 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "SPC Outlook",
          tabBarLabel: "Map",
          headerRight: () => (
            <AppButton
              compact
              label="Info"
              onPress={() => router.push("/about")}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="places"
        options={{ title: "Places", tabBarLabel: "Places" }}
      />
    </Tabs>
  );
}
