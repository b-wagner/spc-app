import { TransformRequestManager } from "@maplibre/maplibre-react-native";
import { USER_AGENT } from "@/features/outlooks/sourceConfig";
let registered = false;
/** Must execute before mounting Map: fetch() headers do not reach native tile requests.
 * Native caching is left enabled; postinstall disables low-zoom prefetch on both platforms.
 * See docs/IMPLEMENTATION_NOTES.md for the native diagnostics and upstream references. */
export function registerMapHeaders() {
  if (registered) return;
  TransformRequestManager.addHeader({
    id: "osm-app-identification",
    name: "User-Agent",
    value: USER_AGENT,
    match: /^https:\/\/tile\.openstreetmap\.org\//,
  });
  if (__DEV__)
    TransformRequestManager.addHeader({
      id: "local-tile-diagnostics",
      name: "User-Agent",
      value: USER_AGENT,
      match: /^http:\/\/(localhost|127\.0\.0\.1):\d+\//,
    });
  registered = true;
}
