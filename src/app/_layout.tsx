import { Stack, router, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StorageProvider } from "@/storage/StorageProvider";
import { OutlookProvider } from "@/features/outlooks/OutlookProvider";
import { PlacesProvider } from "@/features/places/PlacesProvider";
import { AppButton } from "@/components/AppButton";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { styles } from "@/theme/tokens";
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={[styles.screen, styles.content, { justifyContent: "center" }]}>
      <Text style={styles.body}>
        SPC Outlook could not display this screen.
      </Text>
      <AppButton label="Retry" onPress={() => void retry()} />
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ScreenErrorBoundary>
        <StorageProvider>
          <PlacesProvider>
            <OutlookProvider>
              <Stack
                screenOptions={{
                  headerTitle: ({ children }) => (
                    <Text
                      maxFontSizeMultiplier={1.5}
                      style={{ fontSize: 18, fontWeight: "600" }}
                    >
                      {children}
                    </Text>
                  ),
                  headerBackButtonDisplayMode: "minimal",
                  contentStyle: { backgroundColor: "#F3F5F7" },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                {[
                  ["about", "About & data"],
                  ["legend", "Outlook legend"],
                  ["outlook-details", "Forecast details"],
                  ["place-edit", "Save place"],
                ].map(([name, title]) => (
                  <Stack.Screen
                    key={name}
                    name={name}
                    options={{
                      title,
                      presentation: "modal",
                      headerRight: () => (
                        <AppButton
                          compact
                          label="Close"
                          onPress={() => router.back()}
                        />
                      ),
                    }}
                  />
                ))}
              </Stack>
            </OutlookProvider>
          </PlacesProvider>
        </StorageProvider>
      </ScreenErrorBoundary>
    </SafeAreaProvider>
  );
}
