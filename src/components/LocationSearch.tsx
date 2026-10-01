import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { usePlaces } from "@/features/places/PlacesProvider";
import {
  searchPlaces,
  type SearchResult,
  type SearchTransport,
} from "@/features/search/client";
import { errorCode } from "@/utils/errors";
import { colors, styles } from "@/theme/tokens";
import { AppButton } from "./AppButton";
import { ExternalLink } from "./ExternalLink";

/** Submit-only city/place and ZIP search with explicit, accessible result states. */
export function LocationSearch({
  transport,
}: {
  transport?: SearchTransport;
}) {
  const { select } = usePlaces();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "no-results" | "invalid" | "error"
  >("idle");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const submit = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResults([]);
    setState("loading");
    try {
      const found = await searchPlaces(query, controller.signal, transport);
      if (request.current !== controller) return;
      setResults(found);
      setState(found.length ? "idle" : "no-results");
    } catch (error) {
      if (request.current !== controller || errorCode(error) === "CANCELED") return;
      setState(errorCode(error) === "INVALID_SEARCH" ? "invalid" : "error");
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.body}>Find a location</Text>
      <View style={[styles.row, { flexWrap: "nowrap" }]}>
        <TextInput
          accessibilityLabel="U.S. city, place, or ZIP code"
          autoCapitalize="words"
          autoCorrect={false}
          enterKeyHint="search"
          onChangeText={(value) => {
            setQuery(value);
            if (state !== "loading") setState("idle");
          }}
          onSubmitEditing={() => void submit()}
          placeholder="City, place, or ZIP code"
          returnKeyType="search"
          value={query}
          style={{
            flex: 1,
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            fontSize: 16,
            color: colors.text,
            backgroundColor: colors.surface,
          }}
        />
        <AppButton label="Search" pending={state === "loading"} onPress={() => void submit()} />
      </View>
      {state === "loading" && (
        <View accessibilityRole="progressbar" style={styles.row}>
          <ActivityIndicator size="small" />
          <Text style={styles.secondary}>Searching…</Text>
        </View>
      )}
      {state === "invalid" && (
        <Text accessibilityRole="alert" style={styles.secondary}>
          Enter at least two characters or a five-digit ZIP code.
        </Text>
      )}
      {state === "no-results" && (
        <Text accessibilityRole="alert" style={styles.secondary}>
          No locations found in the contiguous United States.
        </Text>
      )}
      {state === "error" && (
        <Text accessibilityRole="alert" style={{ ...styles.secondary, color: colors.errorText }}>
          Location search is unavailable. Check your connection and try again.
        </Text>
      )}
      {results.map((result) => (
        <Pressable
          key={result.id}
          accessibilityRole="button"
          accessibilityLabel={`Show ${result.label} on map`}
          onPress={() => {
            select(
              {
                coordinates: result.coordinates,
                savedPlaceId: null,
                origin: "search",
                label: result.label,
              },
              true,
            );
            setResults([]);
            setQuery(result.label);
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            padding: 10,
            borderRadius: 8,
            backgroundColor: pressed ? "#E4EDF9" : colors.background,
          })}
        >
          <Text style={styles.body}>{result.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.secondary}>Search is limited to the contiguous U.S.</Text>
      <ExternalLink
        label="Search data © OpenStreetMap contributors"
        url="https://www.openstreetmap.org/copyright"
      />
    </View>
  );
}
