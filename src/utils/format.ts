import type { LonLat } from "@/features/outlooks/types";
/** Formats each endpoint separately so DST transitions retain the correct offset. */
export function formatTime(
  value: number | null,
  utc = false,
  timeZone?: string,
) {
  return value === null
    ? "Unavailable"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: utc ? "UTC" : timeZone,
      }).format(value);
}
export function formatCoordinates(p: LonLat) {
  return `${p[1].toFixed(4)}°, ${p[0].toFixed(4)}°`;
}
export function checkedLabel(time: number | undefined, now: number) {
  if (time === undefined) return "Not yet checked";
  if (now < time - 300000) return `Checked ${formatTime(time)}`;
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  return minutes === 0
    ? "Checked just now"
    : minutes < 60
      ? `Checked ${minutes} min ago`
      : `Checked ${formatTime(time)}`;
}
