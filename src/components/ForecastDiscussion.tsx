import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  fetchForecastDiscussion,
  type DiscussionTransport,
  type ForecastDiscussion as Discussion,
} from "@/features/discussion/client";
import type { OutlookDay } from "@/features/outlooks/types";
import { errorCode } from "@/utils/errors";
import { colors, styles } from "@/theme/tokens";
import { AppButton } from "./AppButton";
import { ExternalLink } from "./ExternalLink";

/** On-demand official SPC discussion with retry and safe plain-text rendering. */
export function ForecastDiscussion({
  day,
  transport,
}: {
  day: OutlookDay;
  transport?: DiscussionTransport;
}) {
  const [state, setState] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [requestId, setRequestId] = useState(0);
  const load = useCallback(() => {
    setState("loading");
    setDiscussion(null);
    setRequestId((value) => value + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchForecastDiscussion(day, controller.signal, transport)
      .then((value) => {
        setDiscussion(value);
        setState("ready");
      })
      .catch((error) => {
        if (errorCode(error) === "CANCELED") return;
        setState(
          errorCode(error) === "DISCUSSION_UNAVAILABLE"
            ? "unavailable"
            : "error",
        );
      });
    return () => controller.abort();
  }, [day, requestId, transport]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Forecast Discussion</Text>
      {state === "loading" && (
        <View accessibilityRole="progressbar" style={styles.row}>
          <ActivityIndicator size="small" />
          <Text style={styles.secondary}>Loading discussion…</Text>
        </View>
      )}
      {state === "unavailable" && (
        <Text accessibilityRole="alert" style={styles.secondary}>
          The Forecast Discussion is not available for this day.
        </Text>
      )}
      {state === "error" && (
        <>
          <Text
            accessibilityRole="alert"
            style={{ ...styles.secondary, color: colors.errorText }}
          >
            The Forecast Discussion could not be loaded.
          </Text>
          <AppButton label="Retry discussion" onPress={load} />
        </>
      )}
      {state === "ready" && discussion && (
        <>
          <Text selectable style={styles.body}>{discussion.title}</Text>
          {discussion.issuedLabel && (
            <Text selectable style={styles.secondary}>
              Issued {discussion.issuedLabel}
            </Text>
          )}
          {discussion.validLabel && (
            <Text selectable style={styles.secondary}>{discussion.validLabel}</Text>
          )}
          <Text selectable style={[styles.body, { lineHeight: 25 }]}>
            {discussion.text}
          </Text>
          <ExternalLink
            label="Open official discussion source"
            url={discussion.sourceUrl}
          />
        </>
      )}
    </View>
  );
}
