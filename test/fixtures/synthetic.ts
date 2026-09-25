/** Synthetic geography solely for tests: never bundled as a live fallback. */
export const square = (
  west: number,
  south: number,
  east: number,
  north: number,
) => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
export function feature(
  dn = 4,
  label = "SLGT",
  ring = square(-104, 33, -94, 41),
) {
  return {
    type: "Feature",
    properties: {
      objectid: 1,
      dn,
      label,
      issue: "202609241614",
      valid: "202609241630",
      expire: "202609251200",
    },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
export function collection(...features: ReturnType<typeof feature>[]) {
  return { type: "FeatureCollection", features };
}
export const allCategories = collection(
  ...[2, 3, 4, 5, 6, 8].map((dn, i) =>
    feature(
      dn,
      ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"][i],
      square(-110 + i, 28 + i, -85 - i, 48 - i),
    ),
  ),
);
