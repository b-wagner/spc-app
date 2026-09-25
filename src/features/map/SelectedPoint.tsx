import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { LonLat } from "@/features/outlooks/types";
export function SelectedPoint({ coordinates }: { coordinates: LonLat }) {
  return (
    <GeoJSONSource
      id="selection"
      data={{
        type: "Feature",
        geometry: { type: "Point", coordinates: [...coordinates] },
        properties: {},
      }}
    >
      <Layer
        id="selection-ring"
        type="circle"
        paint={{
          "circle-radius": 9,
          "circle-color": "#FFFFFF",
          "circle-stroke-color": "#17202A",
          "circle-stroke-width": 2,
        }}
      />
      <Layer
        id="selection-center"
        type="circle"
        paint={{ "circle-radius": 4, "circle-color": "#2457A7" }}
      />
    </GeoJSONSource>
  );
}
