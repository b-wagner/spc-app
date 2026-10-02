import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  fetchForecastDiscussion,
  discussionUrl,
  type DiscussionTransport,
  type ForecastDiscussion as Discussion,
} from "@/features/discussion/client";
import type { OutlookDay } from "@/features/outlooks/types";
import { errorCode } from "@/utils/errors";
import { fixtureMode } from "@/utils/clock";
import { colors, styles } from "@/theme/tokens";
import { AppButton } from "./AppButton";
import { ExternalLink } from "./ExternalLink";

export function canLoadForecastDiscussion(
  expected: Parameters<typeof fetchForecastDiscussion>[3] | null,
  demoMode = fixtureMode,
) {
  return Boolean(expected) && !demoMode;
}

/** On-demand official SPC discussion with retry and safe plain-text rendering. */
export function ForecastDiscussion({
  day,
  expected,
  transport,
}: {
  day: OutlookDay;
  expected: Parameters<typeof fetchForecastDiscussion>[3] | null;
  transport?: DiscussionTransport;
}) {
  const [state, setState] = useState<
    "loading" | "ready" | "unavailable" | "mismatch" | "error"
  >("loading");
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [requestId, setRequestId] = useState(0);
  const issuedAt = expected?.issuedAt;
  const validFrom = expected?.validFrom;
  const expiresAt = expected?.expiresAt;
  const disabled =
    !canLoadForecastDiscussion(expected) ||
    issuedAt === undefined ||
    validFrom === undefined ||
    expiresAt === undefined;
  const load = useCallback(() => {
    setState("loading");
    setDiscussion(null);
    setRequestId((value) => value + 1);
  }, []);
  useEffect(() => {
    if (disabled) return;
    let alive = true;
    const controller = new AbortController();
    void fetchForecastDiscussion(day, controller.signal, transport, {
      issuedAt,
      validFrom,
      expiresAt,
    })
      .then((value) => {
        if (!alive || controller.signal.aborted) return;
        setDiscussion(value);
        setState("ready");
      })
      .catch((error) => {
        if (!alive || errorCode(error) === "CANCELED") return;
        setState(
          errorCode(error) === "DISCUSSION_UNAVAILABLE"
            ? "unavailable"
            : errorCode(error) === "DISCUSSION_MISMATCH"
              ? "mismatch"
              : "error",
        );
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [day, requestId, transport, issuedAt, validFrom, expiresAt, disabled]);

  const visibleState = disabled ? "unavailable" : state;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Forecast Discussion</Text>
      {visibleState === "loading" && (
        <View accessibilityRole="progressbar" style={styles.row}>
          <ActivityIndicator size="small" />
          <Text style={styles.secondary}>Loading discussion…</Text>
        </View>
      )}
      {visibleState === "unavailable" && (
        <Text accessibilityRole="alert" style={styles.secondary}>
          {fixtureMode
            ? "Forecast Discussions are disabled for historical demo data."
            : "A matching Forecast Discussion is not available for this outlook."}
        </Text>
      )}
      {visibleState === "mismatch" && (
        <Text accessibilityRole="alert" style={styles.secondary}>
          The current Forecast Discussion does not match this saved outlook.
        </Text>
      )}
      {(visibleState === "unavailable" || visibleState === "mismatch") &&
        !fixtureMode && (
          <ExternalLink
            label="Open current official discussion"
            url={discussionUrl(day)}
          />
        )}
      {visibleState === "error" && (
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
      {visibleState === "ready" && discussion && (
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
