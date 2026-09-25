import { DemoBanner } from "@/components/DemoBanner";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { usePlaces } from "@/features/places/PlacesProvider";
import { validPlaceName, nextPlaceName } from "@/features/places/repository";
import { formatCoordinates } from "@/utils/format";
import { errorCode } from "@/utils/errors";
import { AppButton } from "@/components/AppButton";
import { colors, styles } from "@/theme/tokens";
/** Snapshot editor inputs on opening; failed writes preserve the user's name and stay open. */
export default function PlaceEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    { selection, places, save } = usePlaces();
  const targetId = id ?? selection?.savedPlaceId ?? null,
    existing = places.find((p) => p.id === targetId);
  const [coordinates] = useState(() =>
    existing
      ? ([existing.longitude, existing.latitude] as const)
      : targetId
        ? null
        : (selection?.coordinates ?? null),
  );
  const [name, setName] = useState(
      () => existing?.name ?? nextPlaceName(places),
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const guard = useRef(false);
  const atLimit = !targetId && places.length >= 20;
  const submit = async () => {
    if (guard.current || !coordinates || !validPlaceName(name) || atLimit)
      return;
    guard.current = true;
    setPending(true);
    setError(null);
    try {
      await save(name, coordinates, targetId);
      router.back();
    } catch (e) {
      setError(
        errorCode(e) === "PLACE_LIMIT"
          ? "You can save up to 20 places. Delete one to add another."
          : "Could not save this place. Your changes are still here; try again.",
      );
    } finally {
      guard.current = false;
      setPending(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{ title: existing ? "Edit place" : "Save place" }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <DemoBanner />
        {!coordinates || (targetId && !existing) ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              Choose a point on the map before saving a place.
            </Text>
            <AppButton label="Go to map" onPress={() => router.replace("/")} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>Place name</Text>
            <TextInput
              accessibilityLabel="Place name"
              autoFocus
              value={name}
              onChangeText={setName}
              editable={!pending}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 12,
                fontSize: 18,
                minHeight: 48,
                color: colors.text,
              }}
            />
            <Text selectable style={styles.secondary}>
              {formatCoordinates(coordinates)}
            </Text>
            <Text style={styles.secondary}>
              Use 1–40 characters. Coordinates stay on this device.
            </Text>
            {atLimit && (
              <Text style={styles.body}>
                You can save up to 20 places. Delete one to add another.
              </Text>
            )}
            {error && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.errorText }}
              >
                {error}
              </Text>
            )}
            <View style={styles.row}>
              <AppButton
                label="Cancel"
                disabled={pending}
                onPress={() => router.back()}
              />
              <AppButton
                label="Save"
                pending={pending}
                disabled={!validPlaceName(name) || atLimit}
                onPress={() => void submit()}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
