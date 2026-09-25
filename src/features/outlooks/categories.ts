import type { CategoryCode } from "./types";
export const CATEGORIES = [
  {
    dn: 2,
    code: "TSTM",
    rank: 0,
    label: "General thunderstorms",
    fill: "#C1E9C1",
    outline: "#558755",
  },
  {
    dn: 3,
    code: "MRGL",
    rank: 1,
    label: "Marginal risk",
    fill: "#66A366",
    outline: "#005500",
  },
  {
    dn: 4,
    code: "SLGT",
    rank: 2,
    label: "Slight risk",
    fill: "#FFE066",
    outline: "#DDAA00",
  },
  {
    dn: 5,
    code: "ENH",
    rank: 3,
    label: "Enhanced risk",
    fill: "#FFA366",
    outline: "#FF6600",
  },
  {
    dn: 6,
    code: "MDT",
    rank: 4,
    label: "Moderate risk",
    fill: "#E06666",
    outline: "#CC0000",
  },
  {
    dn: 8,
    code: "HIGH",
    rank: 5,
    label: "High risk",
    fill: "#EE99EE",
    outline: "#CC00CC",
  },
] as const;
/** The sole trusted palette and severity mapping; feed colors never enter styles. */
export function categoryInfo(code: CategoryCode) {
  return CATEGORIES.find((c) => c.code === code)!;
}
/** General thunderstorms is intentionally separate from the five severe levels. */
export function categoryLabel(code: CategoryCode) {
  const c = categoryInfo(code);
  return c.rank ? `${c.label} · Level ${c.rank} of 5` : c.label;
}
