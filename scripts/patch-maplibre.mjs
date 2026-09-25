/** MapLibre RN 11.4.0 has no JS prefetch toggle. Disable native low-zoom prefetch
 * for viewport-only OSM use. Remove this patch when an upstream prop can do this.
 * See docs/IMPLEMENTATION_NOTES.md. Fail loudly if the pinned source changes. */
import { readFileSync, writeFileSync } from "node:fs";
const root = "node_modules/@maplibre/maplibre-react-native";
const version = JSON.parse(readFileSync(`${root}/package.json`)).version;
if (version !== "11.4.0")
  throw Error(`Review tile prefetch patch for MapLibre ${version}`);
for (const [file, needle, replacement] of [
  [
    "ios/components/map-view/MLRNMapView.m",
    "    self.delegate = self;",
    "    self.delegate = self;\n    self.prefetchesTiles = NO; // SPC Outlook: viewport tiles only.",
  ],
  [
    "android/src/main/java/org/maplibre/reactnative/components/mapview/MLRNMapView.kt",
    "        this.mapLibreMap = mapLibreMap",
    "        this.mapLibreMap = mapLibreMap\n        mapLibreMap.setPrefetchZoomDelta(0) // SPC Outlook: viewport tiles only.",
  ],
]) {
  const path = `${root}/${file}`,
    source = readFileSync(path, "utf8");
  if (source.includes(replacement)) continue;
  if (!source.includes(needle))
    throw Error(`Cannot apply viewport-only patch: ${file}`);
  writeFileSync(path, source.replace(needle, replacement));
}
