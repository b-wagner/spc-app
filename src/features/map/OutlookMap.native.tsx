/** Native renderer only: receives validated data from the single weather repository. */
import {
  Camera,
  LogManager,
  Map,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { OutlookSnapshot } from "@/features/outlooks/types";
import { usePlaces } from "@/features/places/PlacesProvider";
import { basemapStyle } from "./basemap";
import { registerMapHeaders } from "./requestHeaders";
import {
  MAP_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  NATIONAL_BOUNDS,
} from "./camera";
import { OutlookLayers } from "./layers";
import { SelectedPoint } from "./SelectedPoint";
import { StatusBanner } from "@/components/StatusBanner";
registerMapHeaders();
/** One press handler; geometry hit-testing is deliberately outside the renderer. */
export default function OutlookMap({
  snapshot,
  expired,
}: {
  snapshot: OutlookSnapshot | null;
  expired: boolean;
}) {
  const { selection, select, initialCamera, cameraRequest, rememberCamera } =
    usePlaces();
  const camera = useRef<CameraRef>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!cameraRequest) return;
    if (cameraRequest.camera)
      camera.current?.jumpTo({
        center: [...cameraRequest.camera.center],
        zoom: cameraRequest.camera.zoom,
        bearing: 0,
        pitch: 0,
      });
    else
      camera.current?.fitBounds(NATIONAL_BOUNDS, {
        padding: MAP_PADDING,
        duration: 0,
        bearing: 0,
        pitch: 0,
      });
  }, [cameraRequest]);
  useEffect(() => {
    // Native resource errors may occur after style-loaded. One boolean deduplicates tile noise.
    LogManager.onLog(({ level, message }) => {
      if (
        (level === "error" || level === "warn") &&
        /tile|request|resource/i.test(message) &&
        !/cancel/i.test(message)
      ) {
        setFailed(true);
        return true;
      }
      return false;
    });
    return () => LogManager.onLog(() => false);
  }, []);
  return (
    <View style={{ flex: 1, minHeight: 180 }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={basemapStyle}
        touchRotate={false}
        touchPitch={false}
        attribution={false}
        logo={false}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Outlook map. Tap to inspect a point. Forecast details are available below."
        onPress={(event) =>
          select({
            coordinates: [...event.nativeEvent.lngLat],
            savedPlaceId: null,
            origin: "map",
          })
        }
        onRegionDidChange={(event) => {
          if (event.nativeEvent.userInteraction)
            rememberCamera({
              center: event.nativeEvent.center,
              zoom: event.nativeEvent.zoom,
            });
        }}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        <Camera
          ref={camera}
          initialViewState={
            initialCamera
              ? { center: [...initialCamera.center], zoom: initialCamera.zoom }
              : { bounds: NATIONAL_BOUNDS, padding: MAP_PADDING }
          }
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          maxBounds={NATIONAL_BOUNDS}
          bearing={0}
          pitch={0}
        />
        <OutlookLayers snapshot={snapshot} expired={expired} />
        {selection && <SelectedPoint coordinates={selection.coordinates} />}
      </Map>
      <StatusBanner
        message={failed ? "Background map may be incomplete." : null}
      />
    </View>
  );
}
