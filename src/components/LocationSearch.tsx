import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { usePlaces } from "@/features/places/PlacesProvider";
import { useLocationSearch } from "@/features/search/SearchProvider";
import type { SearchResult } from "@/features/search/types";
import { parseSearchQuery } from "@/features/search/normalize";
import { errorCode } from "@/utils/errors";
import { colors, styles } from "@/theme/tokens";
import { AppButton } from "./AppButton";

/** Debounced, local city and ZCTA search with explicit accessible result states. */
export function LocationSearch() {
  const { select } = usePlaces();
  const searchProvider = useLocationSearch();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "no-results" | "invalid" | "error"
  >("idle");
  const request = useRef<AbortController | null>(null);
  const skipNextDebouncedSearch = useRef(false);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  const submit = async () => {
    request.current?.abort();
    try {
      parseSearchQuery(query);
    } catch {
      setResults([]);
      setState("invalid");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setResults([]);
    setState("loading");
    try {
      const found = await searchProvider.search(query, controller.signal);
      if (request.current !== controller) return;
      setResults(found);
      setState(found.length ? "idle" : "no-results");
    } catch (error) {
      if (request.current !== controller || errorCode(error) === "CANCELED") return;
      setState(errorCode(error) === "INVALID_SEARCH" ? "invalid" : "error");
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  useEffect(() => {
    if (skipNextDebouncedSearch.current) {
      skipNextDebouncedSearch.current = false;
      return;
    }
    try {
      parseSearchQuery(query);
    } catch {
      return;
    }
    const timer = setTimeout(() => void submit(), 275);
    return () => clearTimeout(timer);
  // `submit` reads the current query/provider; changes intentionally restart the debounce.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchProvider]);

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
            request.current?.abort();
            setQuery(value);
            setResults([]);
            try {
              parseSearchQuery(value);
              if (state !== "loading") setState("idle");
            } catch {
              setState(value ? "invalid" : "idle");
            }
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
          <Text accessibilityLiveRegion="polite" style={styles.secondary}>Searching locally…</Text>
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
          Local location search is unavailable on this device.
        </Text>
      )}
      {results.map((result) => (
        <Pressable
          key={result.id}
          accessibilityRole="button"
          accessibilityLabel={`Show ${result.label} on map`}
          onPress={() => {
            request.current?.abort();
            skipNextDebouncedSearch.current = true;
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
      <Text style={styles.secondary}>
        Offline search covers Census Places and ZCTAs in the contiguous U.S.
      </Text>
    </View>
  );
}
