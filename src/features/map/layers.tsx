import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { CATEGORIES } from "@/features/outlooks/categories";
import type { OutlookSnapshot } from "@/features/outlooks/types";
/** Stable source/layer IDs preserve the map/camera. Highest risk draws last. */
export function OutlookLayers({
  snapshot,
  expired,
}: {
  snapshot: OutlookSnapshot | null;
  expired: boolean;
}) {
  if (!snapshot || snapshot.kind === "empty-unverified") return null;
  // Direct Layer children are required: GeoJSONSource injects source IDs by cloning.
  // A Fragment would receive that prop instead of the native layers.
  return (
    <GeoJSONSource id="outlook" data={snapshot.geojson}>
      {CATEGORIES.flatMap((c) => [
        <Layer
          key={`fill-${c.code}`}
          id={`fill-${c.code}`}
          type="fill"
          filter={["==", ["get", "category"], c.code]}
          paint={{
            "fill-color": c.fill,
            "fill-opacity": expired ? 0.12 : 0.35,
          }}
        />,
        <Layer
          key={`line-${c.code}`}
          id={`line-${c.code}`}
          type="line"
          filter={["==", ["get", "category"], c.code]}
          paint={{
            "line-color": expired ? "#788591" : c.outline,
            "line-width": 1.5,
            "line-dasharray": expired ? [3, 3] : [1, 0],
          }}
        />,
      ])}
    </GeoJSONSource>
  );
}
