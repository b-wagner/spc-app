import { DemoBanner } from "@/components/DemoBanner";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useOutlook } from "@/features/outlooks/useOutlook";
import { usePlaces } from "@/features/places/PlacesProvider";
import { DAYS, type OutlookDay } from "@/features/outlooks/types";
import {
  assessPoint,
  statusMessage,
  temporalState,
  OUTSIDE_COPY,
} from "@/features/outlooks/validity";
import { spcUrl } from "@/features/outlooks/sourceConfig";
import { formatTime } from "@/utils/format";
import { ExternalLink } from "@/components/ExternalLink";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBanner } from "@/components/StatusBanner";
import { ForecastDiscussion } from "@/components/ForecastDiscussion";
import { styles } from "@/theme/tokens";
export default function Details() {
  const params = useLocalSearchParams<{ day?: string }>(),
    outlook = useOutlook(),
    { selection } = usePlaces();
  const parsed = Number(params.day),
    day: OutlookDay = DAYS.includes(parsed as OutlookDay)
      ? (parsed as OutlookDay)
      : outlook.day;
  const state = outlook.states[day],
    s = state.snapshot;
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <DemoBanner />
      <Text style={styles.title}>Day {day} categorical outlook</Text>
      <StatusBanner message={statusMessage(state, day, outlook.now)} />
      {selection && (
        <RiskBadge
          assessment={assessPoint(s, selection.coordinates, outlook.now)}
        />
      )}
      <View style={styles.card}>
        {[
          ["Issued", s?.issuedAt ?? null],
          ["Valid from", s?.validFrom ?? null],
          ["Valid until", s?.expiresAt ?? null],
          ["Checked", s?.checkedAt ?? null],
          ["Downloaded", s?.downloadedAt ?? null],
        ].map(([label, time]) => (
          <View key={label} style={{ gap: 4, paddingVertical: 4 }}>
            <Text style={styles.body}>{label}</Text>
            <Text selectable style={styles.secondary}>
              {formatTime(time as number | null)}
            </Text>
            <Text selectable style={styles.secondary}>
              {formatTime(time as number | null, true)}
            </Text>
          </View>
        ))}
      </View>
      <ForecastDiscussion
        key={`${day}-${s?.issuedAt ?? "unavailable"}`}
        day={day}
        expected={
          s?.kind === "forecast"
            ? {
                issuedAt: s.issuedAt!,
                validFrom: s.validFrom!,
                expiresAt: s.expiresAt!,
              }
            : null
        }
      />
      <View style={styles.card}>
        <Text style={styles.body}>
          Cache status:{" "}
          {s
            ? `${temporalState(s, outlook.now)} · ${s.noStore ? "memory only" : "saved on this device"}`
            : "No saved outlook"}
        </Text>
        <Text style={styles.secondary}>
          Checked is the last successful retrieval or revalidation. It does not
          mean the forecast was newly issued. The data service can lag issuance.
        </Text>
        <Text selectable style={styles.secondary}>
          Source: NOAA/NWS Storm Prediction Center
        </Text>
        <ExternalLink label="Open official SPC outlook" url={spcUrl(day)} />
      </View>
      <View style={styles.card}>
        <Text style={styles.body}>About this view</Text>
        <Text style={styles.secondary}>{OUTSIDE_COPY}</Text>
        <Text style={styles.secondary}>
          This app displays outlooks and does not provide emergency warnings.
        </Text>
      </View>
    </ScrollView>
  );
}
