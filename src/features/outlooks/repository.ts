import { AppError } from "@/utils/errors";
import { normalizeOutlook } from "./normalize";
import type { FetchResult } from "./client";
import type { OutlookDay, OutlookSnapshot } from "./types";
export interface ForecastStore {
  load(): Promise<Partial<Record<OutlookDay, OutlookSnapshot>>>;
  put(snapshot: OutlookSnapshot): Promise<void>;
  remove(day: OutlookDay): Promise<void>;
  clear(): Promise<void>;
}
/** A later validity period is progression; older validity or issuance is a CDN rollback. */
export function acceptResponse(
  result: FetchResult,
  old: OutlookSnapshot | null,
  day: OutlookDay,
  now: number,
): OutlookSnapshot {
  if (result.kind === "not-modified") {
    if (!old) throw new AppError("MISSING_304_BODY");
    return {
      ...old,
      ...result.meta,
      etag: result.meta.noStore ? null : (result.meta.etag ?? old.etag),
      lastModified: result.meta.noStore
        ? null
        : (result.meta.lastModified ?? old.lastModified),
      checkedAt: now,
    };
  }
  const next = { ...normalizeOutlook(result.raw, day, now), ...result.meta };
  if (
    old?.kind === "forecast" &&
    next.kind === "forecast" &&
    (next.validFrom! < old.validFrom! ||
      (next.validFrom === old.validFrom && next.issuedAt! < old.issuedAt!))
  )
    throw new AppError("OLDER_PRODUCT");
  return next;
}
