import { AppError } from "@/utils/errors";
/** Parses NOAA's strict YYYYMMDDHHmm UTC format, rejecting normalized impossible dates. */
export function parseSpcUtc(value: unknown): number {
  if (typeof value !== "string" || !/^\d{12}$/.test(value))
    throw new AppError("INVALID_TIMESTAMPS");
  const [y, m, d, h, min] = [
    value.slice(0, 4),
    value.slice(4, 6),
    value.slice(6, 8),
    value.slice(8, 10),
    value.slice(10, 12),
  ].map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, h, min));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== min
  )
    throw new AppError("INVALID_TIMESTAMPS");
  return date.getTime();
}
