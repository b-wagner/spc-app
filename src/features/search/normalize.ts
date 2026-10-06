import { AppError } from "@/utils/errors";
import type { ParsedSearchQuery } from "./types";
import {
  normalizePlaceName as sharedNormalizePlaceName,
  normalizeSearchText as sharedNormalizeSearchText,
} from "./normalization.js";

const STATE_ALIASES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI",
  idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const STATE_ABBREVIATIONS = new Set(Object.values(STATE_ALIASES));

/** Shared lookup normalization used by the app and the database generator. */
export function normalizeSearchText(value: string) {
  try {
    return sharedNormalizeSearchText(value);
  } catch {
    throw new AppError("INVALID_SEARCH");
  }
}

/** Removes Census legal/statistical suffixes for the searchable city key. */
export function normalizePlaceName(value: string) {
  try {
    return sharedNormalizePlaceName(value);
  } catch {
    throw new AppError("INVALID_SEARCH");
  }
}

export function parseSearchQuery(value: string): ParsedSearchQuery {
  const raw = value.trim();
  if (!raw || raw.length > 100) throw new AppError("INVALID_SEARCH");
  if (/^\d+$/.test(raw)) {
    if (!/^\d{5}$/.test(raw)) throw new AppError("INVALID_SEARCH");
    return { kind: "zip", zip: raw };
  }
  const normalized = normalizeSearchText(raw);
  if (!normalized) throw new AppError("INVALID_SEARCH");
  const words = normalized.split(" ");
  let state: string | null = null;
  let city = normalized;
  for (let length = Math.min(3, words.length - 1); length >= 1; length--) {
    const candidate = words.slice(-length).join(" ");
    const abbreviation = candidate.length === 2 ? candidate.toUpperCase() : null;
    const resolved =
      (abbreviation && STATE_ABBREVIATIONS.has(abbreviation) && abbreviation) ||
      STATE_ALIASES[candidate];
    if (resolved) {
      state = resolved;
      city = words.slice(0, -length).join(" ");
      break;
    }
  }
  if (city.length < 2) throw new AppError("INVALID_SEARCH");
  return { kind: "city", city, state };
}
