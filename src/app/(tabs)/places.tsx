import { DemoBanner } from "@/components/DemoBanner";
import { Alert, FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import { usePlaces } from "@/features/places/PlacesProvider";
import { PlaceRow } from "@/features/places/PlaceRow";
import { AppButton } from "@/components/AppButton";
import { styles } from "@/theme/tokens";
export default function PlacesScreen() {
  const { places, select, remove } = usePlaces();
  return (
    <FlatList
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { flexGrow: 1 }]}
      ListHeaderComponent={DemoBanner}
      data={places}
      keyExtractor={(p) => p.id}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={
        <View style={styles.card}>
          <Text style={styles.title}>Your places</Text>
          <Text style={styles.body}>
            Tap a point on the map, then choose Save place. Your places stay on
            this device.
          </Text>
          <AppButton label="Go to map" onPress={() => router.navigate("/")} />
        </View>
      }
      renderItem={({ item }) => (
        <PlaceRow
          place={item}
          onSelect={() => {
            select(
              {
                coordinates: [item.longitude, item.latitude],
                savedPlaceId: item.id,
                origin: "place",
              },
              true,
            );
            router.navigate("/");
          }}
          onDelete={() =>
            Alert.alert(
              "Delete place?",
              `Remove ${item.name} from this device?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    void remove(item.id).catch(() =>
                      Alert.alert(
                        "Could not delete place",
                        "Local storage is unavailable. Your place has not been removed.",
                      ),
                    );
                  },
                },
              ],
            )
          }
        />
      )}
    />
  );
}
