import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { fixtureMode } from "@/utils/clock";
export const BASEMAP_PROVIDER = {
  id: "osm",
  tileTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  attributionUrl: "https://www.openstreetmap.org/copyright",
  tileSize: 256,
  maxZoom: 19,
};
/** Explicit loopback-only diagnostic override. Never a remotely configured provider. */
const testTiles =
  __DEV__ &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(
    process.env.EXPO_PUBLIC_TEST_TILE_URL ?? "",
  )
    ? process.env.EXPO_PUBLIC_TEST_TILE_URL
    : undefined;
export const backgroundStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#E8EDF2" },
    },
  ],
};
export const basemapStyle: StyleSpecification =
  fixtureMode && !testTiles
    ? backgroundStyle
    : {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [testTiles ?? BASEMAP_PROVIDER.tileTemplate],
            tileSize: 256,
            maxzoom: 19,
            attribution: BASEMAP_PROVIDER.attribution,
          },
        },
        layers: [
          ...backgroundStyle.layers,
          {
            id: "osm-basemap",
            type: "raster",
            source: "osm",
            paint: { "raster-opacity": 1 },
          },
        ],
      };
