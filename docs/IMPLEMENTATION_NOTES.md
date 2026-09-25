# Implementation notes — v0.1

Implemented September 24–25, 2026, in the existing working tree. The supplied plan/design were preserved. No commit, push, store publication, credentials, or backend was introduced.

## Architecture

Expo Router exposes Map and Places tabs plus modal editor, legend, forecast details, and About screens. Providers own one SQLite connection, saved places/preferences, and one foreground-only forecast scheduler. Components consume the same per-day snapshot; no component fetches its own weather. Selection is ephemeral unless it refers to a saved place. Day selection resets to Day 1 on launch. User camera changes are debounced; locating and selection use explicit camera commands.

The scheduler serializes requests globally, deduplicates days, prioritizes pending selected-day work, and applies per-day automatic/manual deadlines, expiry handling, HTTP freshness, exponential retry backoff, jitter and Retry-After. It cancels obsolete operations, prevents late responses from undoing a weather-cache clear, and serializes durable writes. A 304 retains the original body/download time while advancing checked time. No-store responses are memory-only and remove previously persisted weather for that day.

Normalization rejects a complete snapshot if any feature or shared issuance tuple is invalid. Geometry retains holes and MultiPolygons. On-device Turf lookup includes boundaries and chooses the highest overlapping category. Empty collections are unverified rather than evidence of no risk. Missing/expired data cannot yield a current assessment. Device-clock regressions are qualified. Exact UTC parsing is independent of display timezone.

SQLite migrations are atomic; newer schemas fail visibly rather than being destroyed. Cache corruption removes only the bad weather row. Places use bound statements and transactional write-first updates, a 20-place limit and Unicode-aware names. Storage failure leaves readable memory-only weather, and failed place writes retain editor input. A one-shot foreground location operation has an overall timeout and generation cancellation; manual selection supersedes a late GPS result.

## Resolved baseline and compatibility work

Core: Expo 56.0.22, React 19.2.3, RN 0.85.3, MapLibre 11.4.0. Other resolved packages include Expo Router 56.2.21, Location 56.0.26, SQLite 56.0.6, build-properties 56.0.27, Babel preset 56.0.20, Reanimated 4.3.1, Worklets 0.8.3, Jest 29.7.0 and React Native Testing Library 13.3.3. `package-lock.json` is authoritative. Node 22.23.3/npm 10.9.9 were used. Direct expo-font and matching React test renderer avoid duplicate/mismatched peer packages. Expo Doctor passed all 22 checks.

Three deliberate native compatibility changes preserve the plan's SDK 56 baseline:

1. **Xcode 27 scene lifecycle.** The default SDK 56 application failed at launch under the new UIScene requirement. `plugins/with-scene-lifecycle.js` adds a single-window scene manifest/delegate, starts React Native with the scene window and forwards events to Expo's app delegate. Native output is generated, not hand-maintained. Revisit this shim when upgrading to an Expo version with supported scene lifecycle ([Expo guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md)).
2. **Legacy Hermes.** Expo Doctor flagged the installed Hermes V1 memory regression. `expo-build-properties` sets `useHermesV1: false` and `buildReactNativeFromSource: true`; the compiler override is `hermes-compiler: 0.15.0`. Crucially, `babel.config.js` also selects Expo's `hermes-v0` native transform. Without it SDK 56 defaults to V1 transforms, causing `Property 'MessageQueue' doesn't exist` at startup even though the native build succeeds. The final simulator run verified the corrected configuration. This increases initial native build time. See [build-properties](https://docs.expo.dev/versions/v56.0.0/sdk/build-properties/).
3. **Disable native tile prefetch.** MapLibre has no equivalent exposed JS property in this pinned version. `scripts/patch-maplibre.mjs` is an idempotent, version-checked postinstall patch: iOS `prefetchesTiles = NO`, Android `setPrefetchZoomDelta(0)`. Unexpected upstream source fails installation loudly. Reevaluate this patch on MapLibre upgrades. Android source application is verified; runtime is not.

MapLibre GeoJSONSource needs direct Layer children because it injects source IDs. Layers are a flat ordered array, not wrapped in fragments. The bundled raster style needs no remotely loaded glyphs/sprites. A request transform identifies OSM requests before creating the map. Essential forecast information remains textual outside the map. Navigation titles remain unscaled to fit native fixed-height headers; header buttons cap at 2×, while forecast/body text continues to scale and content scrolls.

## Source observations

NOAA's layer metadata and actual GeoJSON were inspected rather than assuming field names. Layers 1/9/17 represent Day 1/2/3 categorical products. Requested properties are lower-case (`dn`, `label`, `issue`, `valid`, `expire`, provenance fields). The service supplies 12-digit UTC timestamps. Categories are mapped locally: DN 2/3/4/5/6/8 → general thunderstorms/marginal/slight/enhanced/moderate/high; vendor fill/stroke values do not control app style.

The three captured national responses total approximately 15 KB: Day 1 8,154 bytes/2 features; Day 2 3,445/1; Day 3 3,207/2. Exact retrieval times, URLs and issuance tuples are recorded in `test/fixtures/manifest.json`. They are historical development fixtures, not current weather. They do not contain every category; synthetic fixtures cover all six, nested risk, boundaries and holes. The fixed demo clock precedes some captured issue times, so those products are intentionally displayed as upcoming. Fixture weather uses memory-only storage and a visible demo warning on every screen.

## Native header/cache evidence

The development-only loopback tile override uses the same native raster loader and header transform as the OSM style. `scripts/tile-diagnostics.mjs` serves a synthetic PNG with explicit cache headers/ETag; it does not proxy OSM. Captured iOS requests in `evidence/ios-tile-requests.jsonl` show `SPCOutlookPrototype/0.1.0` on initial 200 and conditional 304 requests. Three one-hour tiles fetched at 02:56 UTC were expired by the 12:21 UTC run; each sent `If-None-Match` and received 304. After another process restart and visibly successful map load, the log stayed at six requests, confirming reuse while fresh.

Read-only inspection of MapLibre's native SQLite cache also found the synthetic one-hour expiry and server-supplied OSM freshness (roughly 4.7–5.2 days for the observed responses). Weather SQLite is separate. This establishes iOS behavior for the tested native loader; it does not establish Android behavior, and the local synthetic capture does not claim to be a packet capture at OSM. No bulk tile traffic or offline pack was generated. See [OSM policy](https://operations.osmfoundation.org/policies/tiles/).

## Remaining validation scope

See `VALIDATION.md`. Android build/run, physical hardware, full screen-reader navigation, small-phone coverage, same-issuance official graphical comparison and end-to-end airplane-mode checks require follow-up. These are not counted as passed tests. Public feed contents and tile availability change independently of app code.
