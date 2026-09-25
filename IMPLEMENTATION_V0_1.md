# SPC Outlook — v0.1 Implementation Plan

Date: September 24, 2026  
Status: Executable implementation specification; no app code has been built or tested yet  
Product definition: [PRODUCT_DESIGN.md](./PRODUCT_DESIGN.md)

## 1. Assignment and completion boundary

Build a local, runnable iOS/Android application named **SPC Outlook** using this document and the product design. Implement the complete v0.1 scope described below. Make routine implementation decisions using the defaults here; do not ask the user to choose libraries, layouts, names, colors, or scope already specified.

Do not deploy a website, create cloud resources, subscribe to paid services, create app-store listings, submit builds, purchase accounts, or implement publishing automation. Do not commit or push unless separately requested. Preserve existing repository files and user changes.

The required result is source code, local build configuration, tests, reproducible setup instructions, and evidence that the app runs. Missing SDKs, unavailable simulators, signing credentials, or network restrictions are environment blockers to report precisely; they are not reasons to invent a successful run or silently substitute a web app.

### Required v0.1 functionality

- Day 1, Day 2, and Day 3 **categorical** convective outlooks.
- Interactive OSM basemap with NOAA GeoJSON overlays.
- Point selection and highest-category lookup.
- Saved places, editable names, deletion, and persistence.
- Optional one-shot foreground device location.
- Persistent weather cache and explicit loading/error/expiry states.
- Legend, forecast details, source links, and About & data.
- Two tabs: Map and Places.
- iOS and Android native development builds.

### Explicit exclusions

No Days 4–8, individual hazard probabilities, CIG layers, watches, warnings, storm reports, radar, mesoscale discussions, model data, background refresh, push alerts, widgets, geocoding, accounts, synchronization, analytics, payments, advertisements, dark theme, web target, offline map packs, or publishing. Do not add disabled buttons advertising these features.

## 2. Fixed implementation decisions

| Decision | Default |
|---|---|
| Repository layout | One application at repository root; preserve both design documents |
| App display name | SPC Outlook |
| Expo slug | `spc-outlook` |
| Version | `0.1.0` |
| Local app identifiers | `dev.spcoutlook.prototype` for iOS bundle ID and Android package |
| URL scheme | `spcoutlook` |
| Primary language | English |
| Devices | Phones, portrait orientation; adaptable layout for large text/small screens |
| App theme | Light, system fonts |
| Runtime | Node.js 22 LTS, latest available 22.x patch meeting Expo's requirements |
| Package manager | npm; retain one `package-lock.json` |
| Framework baseline | Expo SDK 56, its compatible React Native 0.85 / React 19.2.3 versions |
| Map library baseline | `@maplibre/maplibre-react-native@11.4.0` |
| Native architecture | React Native New Architecture |
| Build method | Local Expo development builds, no EAS account requirement |
| Data provider | NOAA ArcGIS REST GeoJSON endpoint described in section 6 |
| Persistent store | SQLite file `spc-outlook.db` |
| State management | React context plus `useReducer`; no Redux/Zustand/query library required |
| Point geometry | `@turf/boolean-point-in-polygon` and `@turf/helpers` |
| UI | React Native core components, Expo Router, safe-area context |
| Maximum saved places | 20 |
| Default forecast day | Day 1 on every cold launch |
| Network timeout | 15 seconds per weather request |
| Maximum concurrent weather fetches | 1 |
| Automatic refresh interval | 15 minutes per product while the app is active |
| Minimum manual request interval | 60 seconds per product; never bypass server backoff |

The Expo 56 family is a deliberate conservative baseline: MapLibre 11.4.0's published package uses Expo 56.0.8 / RN 0.85.3 / React 19.2.3 in its development dependencies. Its declared peer ranges admit this family. That is evidence for a starting combination, not proof that this app has been compiled. The latest Expo documentation also describes SDK 57; do not upgrade major versions merely because they are newer.

Resolve compatible patch versions with Expo's installer, record the exact installed versions in `docs/IMPLEMENTATION_NOTES.md`, and commit them to the lockfile if a commit is later requested. Read installed types rather than mixing v10 and v11 MapLibre examples. If a reproducible native dependency conflict requires a version adjustment, stay within these major families first and document the reason and resulting successful build. Do not change the product or choose a paid map provider to work around a setup problem.

The `expo-template-default` `sdk-56` tag was also checked during preparation: it resolved to template 56.0.36, declaring Expo `~56.0.22`, React Native `0.85.3`, and React `19.2.3`. This verifies the scaffold tag exists. Resolve its permitted patch versions at installation and record the resulting lockfile; do not treat a documentation-time registry lookup as a native build test.

## 3. Initial environment inspection and bootstrap

### 3.1 Inspect before changing files

1. Read applicable `AGENTS.md` instructions and the two design documents.
2. Inspect `git status`, existing source/configuration, Node/npm versions, and available disk space.
3. Check Xcode and selected command-line tools on macOS; check an installed iOS Simulator runtime.
4. Check Java, Android Studio/SDK, `adb`, and a configured Android emulator if available.
5. Verify the Java/Gradle/SDK versions required by the generated Expo 56 Android project; use its generated build configuration rather than arbitrarily selecting target SDKs.
6. Record what can actually run locally. Creating source and running JavaScript tests can proceed if one native toolchain is unavailable.
7. Do not silently install large system toolchains or accept licenses on the user's behalf if the environment requires user action.

### 3.2 Create the project safely

Use the Expo Router default template for SDK 56. A typical starting command is:

```sh
npx create-expo-app@latest spc-outlook-scaffold --template default@sdk-56
```

Run this in a temporary directory because this repository already contains documentation and `.git`. Inspect the result and copy application files into this repository without replacing `.git`, these documents, or user files. Do not leave a nested application project. Do not assume the template's example screens should remain.

If that template tag is unavailable at implementation time, use an Expo-provided SDK 56 template or the documented SDK 56 installation path. Verify the installed `expo` major before proceeding. This is a bootstrap adaptation, not a reason to silently use another major.

Install runtime dependencies using Expo's compatible dependency resolver:

```sh
npx expo install expo-dev-client expo-router expo-sqlite expo-location expo-crypto
npx expo install react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install --save-exact @maplibre/maplibre-react-native@11.4.0
npm install @turf/boolean-point-in-polygon @turf/helpers
npm install --save-dev @types/geojson
npx expo install jest-expo jest @types/jest --dev
npm install --save-dev @testing-library/react-native
npx expo install --check
npx expo-doctor
```

Keep TypeScript, ESLint, and Expo's lint configuration from the template. Resolve test-library peers against the actual React version rather than installing an incompatible renderer. Freeze the successful resolution with the lockfile. Use `npm ci` for subsequent reproducible installs.

Remove template example routes and assets after replacing them. The default template may include web, glass-effect, image, or animation dependencies that this design does not use. Remove unused direct dependencies only after checking imports and plugin configuration; retain Router and its required peers. Do not add a second styling framework or a bottom-sheet library for the fixed summary panel.

### 3.3 App configuration

Set app name, identifiers, scheme, version, portrait orientation, and light UI style. Configure Expo Router, MapLibre's config plugin, and Expo Location. Configure location permission copy as:

> Allow SPC Outlook to show your location on the outlook map. Your location stays on this device.

The app requests only foreground location. Disable background location and foreground-service options in the location plugin. Inspect generated manifests and entitlements to confirm no background-location capability was introduced. Keep the statement accurate: coordinates are not uploaded as weather-query parameters, but map tiles reveal viewed areas as explained in About.

Use a simple locally generated placeholder app icon if needed; no image-generation service is required. No NOAA seal or copied government logo. No secrets or environment variables should be required for the default live-data configuration.

Add scripts with these names:

```json
{
  "start": "expo start --dev-client",
  "ios": "expo run:ios",
  "android": "expo run:android",
  "typecheck": "tsc --noEmit",
  "lint": "expo lint",
  "test": "jest",
  "test:ci": "jest --runInBand",
  "check": "npm run typecheck && npm run lint && npm run test:ci"
}
```

Use strict TypeScript. Do not disable native architecture compatibility checks or suppress real type errors with broad `any` declarations.

## 4. Repository structure and module responsibilities

Use the Router root generated by the template; normalize to `src/app` for this implementation and remove competing route roots.

```text
src/
  app/
    _layout.tsx                    providers, database bootstrap, modal stack
    (tabs)/
      _layout.tsx                  Map and Places tab bar
      index.tsx                    Map screen composition
      places.tsx                   Places screen composition
    about.tsx
    legend.tsx
    outlook-details.tsx
    place-edit.tsx
  components/
    AppButton.tsx
    StatusBanner.tsx
    RiskBadge.tsx
    ForecastDaySelector.tsx
    ForecastSummary.tsx
    ScreenErrorBoundary.tsx
  features/
    outlooks/
      types.ts
      categories.ts
      sourceConfig.ts
      client.ts
      normalize.ts
      timestamps.ts
      validity.ts
      pointRisk.ts
      repository.ts
      scheduler.ts
      OutlookProvider.tsx
      useOutlook.ts
    map/
      OutlookMap.native.tsx
      basemap.ts
      requestHeaders.ts
      camera.ts
      layers.tsx
      SelectedPoint.tsx
    places/
      types.ts
      repository.ts
      PlacesProvider.tsx
      PlaceRow.tsx
    location/
      locateOnce.ts
    settings/
      repository.ts
  storage/
    database.ts
    migrations.ts
  theme/
    tokens.ts
  utils/
    clock.ts
    errors.ts
    format.ts
test/
  fixtures/
  mocks/
  setup.ts
scripts/
  capture-outlook-fixtures.mjs
  check-outlook-feeds.mjs
docs/
  IMPLEMENTATION_NOTES.md
  VALIDATION.md
README.md
PRODUCT_DESIGN.md
IMPLEMENTATION_V0_1.md
```

Routes orchestrate UI; they do not parse provider payloads, write SQL, or implement polygon math. Network clients return raw typed results. Normalizers validate external data. Repositories own persistence and request deduplication. The UI receives immutable normalized snapshots and derived status.

Abstract the clock and HTTP transport for tests. Map rendering must not own weather fetches: pass it a validated GeoJSON object, not a NOAA URL, so there is one authoritative cache and validation path.

### 4.1 Required source-code documentation

**Clear, maintained source-code documentation is a v0.1 deliverable.** The implementation must be understandable to a developer or AI agent reading the repository without access to the original conversation. README instructions and tests complement source comments; they do not replace documentation of important contracts and reasoning next to the implementation.

Use these conventions throughout the React/TypeScript codebase:

- **Descriptive names and explicit types first.** Prefer small, clearly named functions and components. Do not compensate for unnecessarily confusing code with long comments.
- **TSDoc-style documentation comments for meaningful APIs.** Use `/** ... */` above exported domain functions, custom hooks, repositories, providers, and nontrivial shared components. Describe their purpose and any important contract, assumptions, side effects, or failure behavior. Use `@param`, `@returns`, `@throws`, and `@example` where they add useful information. TypeScript already supplies parameter and return types; do not duplicate them with JavaScript-style type annotations in comments.
- **Document data meaning.** Explain coordinate order, units, UTC versus local time, nullable fields, category ranks versus source codes, and distinctions such as downloaded time versus successful check time. Put these explanations on the relevant types or properties so editors expose them to callers.
- **Explain decisions with inline comments.** Document why non-obvious branches, validation rules, cache policies, geometry handling, race protection, or platform workarounds exist. Avoid narrating obvious assignments, JSX markup, or every line of code.
- **Document React lifecycle behavior.** Nontrivial effects and custom hooks should explain their triggers, owned subscriptions/timers/requests, cleanup, and stale-result protection. Document intentional dependency or callback-identity constraints. Do not silence hook dependency warnings without a specific correctness explanation and appropriate verification.
- **Document module boundaries.** Add a short module-level comment where responsibilities or ownership would otherwise be unclear, particularly the scheduler, normalizer, persistence layer, and native map integration. Tiny presentational components do not need boilerplate file headers.
- **Keep external assumptions traceable.** Near provider-specific parsing and native workarounds, link to the relevant official specification, upstream issue, or local implementation note. State the affected version and removal condition for temporary workarounds when known.
- **Keep comments current.** Update comments, examples, and related documentation in the same change as behavior. Remove obsolete comments and commented-out code. Any remaining TODO must identify a concrete follow-up and must not conceal unfinished required v0.1 functionality.

Example of the desired API documentation style:

```ts
/**
 * Finds the highest categorical outlook covering a selected point.
 *
 * Uses the full source geometry so results do not change with map zoom.
 * Boundary points are included, with the higher category winning overlaps.
 * The caller must check forecast availability and validity before presenting
 * this result as an applicable outlook for the selected period.
 *
 * @param point - Coordinates in [longitude, latitude] order, in degrees.
 * @returns The highest matching category, or null when no polygon matches.
 * A null result is not an all-clear or a statement of geographic coverage.
 */
export function getPointCategory(
  snapshot: OutlookSnapshot,
  point: LonLat,
): CategoryCode | null;
```

This is a documentation/signature example, not a complete function implementation. Do not copy it into executable source without implementing the body.

Documentation review must specifically cover forecast parsing, empty/invalid response handling, temporal validity, request deduplication/backoff, polygon boundaries and holes, SQLite migrations, location races, and native tile-header/cache configuration. A separate generated API documentation website is not required for v0.1.

## 5. Mandatory early integration check

Before building the full UI, create a minimal Map screen and prove:

1. The Expo native app builds with MapLibre 11.4.0.
2. A bundled style renders a background and one synthetic polygon.
3. OSM raster tiles load with a unique application User-Agent.
4. One live NOAA categorical GeoJSON response can be parsed and displayed.
5. A tap returns geographic coordinates in the expected order.
6. The native map cache respects HTTP freshness on repeated requests.

Run this on both native platforms available in the environment. Fix version/API issues here before implementing every screen. Record actual versions and any platform-specific behavior. An untested second platform remains an explicit validation gap.

## 6. NOAA integration contract

### 6.1 Base URL and layers

```text
https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer
```

| Day | Layer ID | Expected layer name |
|---|---|---|
| 1 | 1 | Day 1 Categorical Outlook |
| 2 | 9 | Day 2 Categorical Outlook |
| 3 | 17 | Day 3 Categorical Outlook |

Store this mapping centrally in `sourceConfig.ts`. During development, fetch `/{id}?f=pjson` and verify layer names and field definitions. Runtime requests do not need to rediscover the whole service on every launch. A mismatch during the development check must be diagnosed rather than silently using a different product.

### 6.2 Weather request

Use `GET /{layerId}/query` with URL-encoded parameters:

```text
where=1=1
outFields=objectid,dn,label,label2,issue,valid,expire,idp_source,idp_filedate,idp_ingestdate,fill,stroke
returnGeometry=true
outSR=4326
f=geojson
```

For example:

```text
https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/1/query?where=1%3D1&outFields=objectid%2Cdn%2Clabel%2Clabel2%2Cissue%2Cvalid%2Cexpire%2Cidp_source%2Cidp_filedate%2Cidp_ingestdate%2Cfill%2Cstroke&returnGeometry=true&outSR=4326&f=geojson
```

Request the complete national layer, not a location-filtered subset. This permits local inspection of arbitrary points and avoids transmitting saved coordinates to NOAA. Do not append cache-busting query strings.

Set `Accept: application/geo+json, application/json` and `User-Agent: SPCOutlookPrototype/0.1.0` where supported by the native transport. No token or API key is needed for these public endpoints. Do not confuse this source with `api.weather.gov`; v0.1 does not need that API.

### 6.3 Observed response

On September 24, 2026, all three layer queries returned GeoJSON FeatureCollections. The sample included both Polygon and MultiPolygon geometry. One Day 1 feature had these properties:

```json
{
  "objectid": 1,
  "dn": 2,
  "issue": "202609241614",
  "valid": "202609241630",
  "expire": "202609251200",
  "idp_source": "day1otlk_20260924_1630_cat",
  "idp_filedate": 1790266820000,
  "idp_ingestdate": 1790266842000,
  "label": "TSTM",
  "label2": "General Thunderstorms Risk",
  "stroke": "#55BB55",
  "fill": "#C1E9C1"
}
```

This is an observed example, not a fixed fixture to present as current weather. In particular, issuance may precede the nominal valid time. Do not derive issue time from the filename's cycle time.

### 6.4 Validation rules

- Reject HTTP errors, non-JSON bodies, malformed JSON, and top-level ArcGIS `{ error: ... }` responses even if HTTP status is 200.
- Require `type: FeatureCollection` and an array of features.
- Detect `exceededTransferLimit`. If true, mark the response incomplete and do not replace a complete cached snapshot. v0.1 fails safely rather than assembling a potentially inconsistent multi-page forecast. The development probe must verify ordinary payloads are below the service limit.
- Accept only Polygon/MultiPolygon features with non-null geometry, valid finite longitude/latitude positions, closed rings of at least four positions, and correct nesting. Preserve holes and separate polygon parts.
- Request EPSG:4326 output; positions are `[longitude, latitude]`. Do not reinterpret the service's native spatial reference as the returned coordinate order.
- Strip any unneeded altitude coordinate after checking longitude/latitude. Never swap axes to make invalid data appear plausible.
- Normalize property names to lowercase at the adapter boundary if a response changes casing. Accept integer `dn` or an integer string; reject ambiguous values.
- Normalize known category labels to uppercase. If `dn` and a known label disagree, reject the snapshot rather than guessing. A missing label can be reconstructed from a recognized `dn`; a missing/unknown `dn` is unsupported.
- An unknown category, malformed feature, mixed issue/valid/expiration timestamps, or invalid required timestamp invalidates the **whole snapshot**. Dropping only a high-risk polygon could understate risk.
- Allow unknown extra properties for forward compatibility; do not allow them to alter UI or execute code.
- Enforce a 10 MiB weather-response size budget. Reject a response exceeding the limit. Measure actual samples and document if this limit needs adjustment before completion.
- Validate before publishing or writing a new snapshot. Keep the last good snapshot on validation/network errors.

### 6.5 Timestamp parser

Implement `parseSpcUtc(value): number` for the observed strict 12-digit `YYYYMMDDHHmm` strings. Build UTC epoch milliseconds with `Date.UTC`; round-trip every date component to reject invalid dates such as February 30. Do not pass compact numeric strings to `new Date(string)` or assume the device timezone.

Support an explicitly timezone-qualified ISO 8601 string only if captured samples or documented source changes require it; add tests before enabling another format. Reject timezone-less alternate formats. Require `issuedAt <= expiresAt`, `validFrom < expiresAt`, and one consistent tuple across nonempty features. Allow issue time before valid time and allow a future valid period for Days 2–3.

`idp_filedate` and `idp_ingestdate` are optional diagnostic epoch-millisecond fields, not replacements for forecast validity. Missing diagnostic fields should not invalidate otherwise valid forecasts.

### 6.6 Empty responses

A structurally valid empty FeatureCollection is **not sufficient evidence of no severe risk**, because there are no feature timestamps establishing a forecast period.

Represent it as `empty-unverified`, with a successful check timestamp but null forecast times. Clear that day's active overlay and disable point-risk conclusions. Say “No outlook geometry returned. Forecast availability could not be confirmed.” Offer Refresh and Open SPC. Retain the previous nonempty snapshot only as historical storage if desired; do not keep presenting it as the current day after this successful empty response. v0.1 need not implement a second metadata feed just to resolve this case.

### 6.7 Source links

Use fixed, trusted links generated from the selected day:

```text
https://www.spc.noaa.gov/products/outlook/day1otlk.html
https://www.spc.noaa.gov/products/outlook/day2otlk.html
https://www.spc.noaa.gov/products/outlook/day3otlk.html
```

Open in the system browser. No HTML scraping or in-app web view is needed.

## 7. Domain model and geometry

Use equivalent types with these semantics:

```ts
type OutlookDay = 1 | 2 | 3;
type CategoryCode = 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH';
type LonLat = readonly [longitude: number, latitude: number];

interface CategoryProperties {
  category: CategoryCode;
  rank: number;           // TSTM=0, MRGL=1 ... HIGH=5; distinct from source dn
  sourceDn: number;
  sourceObjectId: number | string;
}

interface OutlookSnapshot {
  schemaVersion: 1;
  day: OutlookDay;
  layerId: number;
  kind: 'forecast' | 'empty-unverified';
  issuedAt: number | null;
  validFrom: number | null;
  expiresAt: number | null;
  downloadedAt: number;  // when this body was fetched
  checkedAt: number;     // latest successful fetch/conditional revalidation
  sourceUrl: string;
  sourceProductId: string | null;
  etag: string | null;
  lastModified: string | null;
  httpFreshUntil: number | null;
  geojson: GeoJSON.FeatureCollection<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    CategoryProperties
  >;
}

interface SavedPlace {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  createdAt: number;
  updatedAt: number;
}
```

Use a discriminated union in implementation if useful to guarantee non-null forecast times for `kind: 'forecast'`. Store original necessary fields for diagnostics separately from renderer properties. Use a local UUID from `expo-crypto` for place IDs; IDs never go to a server.

### Category configuration

Own the label, rank, and color lookup in one module. Do not use arbitrary network-provided colors as style expressions. These defaults follow the documented categorical renderer; source `stroke`/`fill` may be retained for diagnostics.

| dn | Code | Rank | UI label | Fill | Outline |
|---|---|---|---|---|---|
| 2 | TSTM | 0 | General thunderstorms | `#C1E9C1` | `#558755` |
| 3 | MRGL | 1 | Marginal risk | `#66A366` | `#005500` |
| 4 | SLGT | 2 | Slight risk | `#FFE066` | `#DDAA00` |
| 5 | ENH | 3 | Enhanced risk | `#FFA366` | `#FF6600` |
| 6 | MDT | 4 | Moderate risk | `#E06666` | `#CC0000` |
| 8 | HIGH | 5 | High risk | `#EE99EE` | `#CC00CC` |

### Point inspection

Implement a pure function against the **full normalized GeoJSON**, independent of zoom level and rendered-feature hitboxes:

```ts
getPointCategory(snapshot: OutlookSnapshot, point: LonLat): CategoryCode | null
```

Use Turf's `booleanPointInPolygon` with boundary inclusion (`ignoreBoundary: false`). Check every feature and choose the greatest configured rank among matches. Handle polygon holes and MultiPolygons. Higher risk wins on a shared boundary; describe boundary values as approximate when a user inspects closely. Do not add a 25-mile buffer to categorical areas.

The domain result must also encode temporal validity and availability before reaching the UI. `null` from polygon lookup means only “not in a displayed polygon”; it does not mean an unavailable feed was checked or that a point is safe. For expired/empty/missing data, return an unavailable risk assessment instead of calling this function as though the forecast were current.

CONUS scope is described in the UI. A rectangular camera extent is not a coverage mask: it includes parts of Canada, Mexico, and ocean. Do not infer geographic coverage from bounds, and do not label all uncolored points “no risk.” A precise land-coverage dataset is not required for v0.1 because the outside-polygon wording makes no coverage assertion.

## 8. Storage and repository behavior

Initialize the SQLite database before rendering persisted app state. Use asynchronous APIs, parameter binding, explicit migrations, and transactional snapshot replacement.

Initial schema:

```sql
CREATE TABLE IF NOT EXISTS forecast_cache (
  day INTEGER PRIMARY KEY CHECK (day IN (1, 2, 3)),
  schema_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  downloaded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

PRAGMA user_version = 1;
```

Run migrations only when the current version requires them; use a transaction for each migration. Do not reset the database to resolve an arbitrary error. A database created by a newer unsupported app schema must produce a clear storage error rather than destructive downgrade.

On hydration, parse and validate cached snapshots against `schemaVersion`. Drop only an invalid forecast-cache row; preserve places. Remove cached forecasts more than 48 hours past expiration. Expired snapshots within that window can appear as explicitly expired reference maps, never current assessments. Empty snapshots expire from storage after 48 hours based on `checkedAt`.

Persistent read/write failure should degrade to memory-only weather browsing and show a non-blocking storage notice. Saving/editing a place must report a failed write rather than pretend persistence succeeded. Do not erase user places or retry corrupt migrations indefinitely.

Store only these optional preferences: last map center/zoom and last selected saved-place ID. Persist camera changes after gesture completion with a 500 ms debounce. Do not persist device GPS fixes or arbitrary unsaved selected coordinates as place records. A saved place selected at launch may center the map; otherwise use a valid saved camera or the national view. Always launch on Day 1.

Represent preferences as `camera = { center: [longitude, latitude], zoom: number }` and `selectedPlaceId = string | null`. Validate coordinates and clamp zoom on restore. If the selected place was deleted, clear that preference and fall back to the stored camera. Application state also holds an ephemeral selection `{ coordinates, savedPlaceId: string | null, origin: 'map' | 'place' | 'device' }`; changing days does not change this selection. Do not pass entire GeoJSON objects through Router parameters. Providers own them, while modal routes receive only a day or place ID.

Cache bounded data: one active snapshot per day, no archive, maximum 20 places. A successful changed response replaces its previous snapshot atomically. A 304 updates check time and cache headers without changing issuance or downloaded time. A 304 without a valid cached body requires one unconditional fetch; if that fails, report unavailable.

## 9. Refresh scheduling and concurrency

### Startup sequence

1. Open/migrate SQLite and hydrate places, preferences, and valid cache rows.
2. Render cached selected-day data immediately.
3. Enqueue a Day 1 check if eligible.
4. After that attempt settles, enqueue eligible Day 2 and Day 3 checks.
5. Keep one global forecast request in flight. A user-selected day moves to the front of the pending queue but does not start a duplicate request.

### Eligibility

- Normal automatic check: at least 15 minutes since the last successful check, subject to HTTP freshness and backoff.
- Respect a longer positive HTTP freshness lifetime. Persist the computed deadline using `Cache-Control`/`Date`/`Age` or `Expires` as applicable. `no-cache` means revalidate, not “discard”; `no-store` means do not persist that response body or validators and remove that day's older durable cache row.
- Expiration overrides the ordinary 15-minute app interval: enqueue revalidation when the clock passes `expiresAt`, but still respect an explicit server backoff and do not run a request loop. Prefer conditional validation rather than cache busting.
- Manual refresh may revalidate before the app interval, but only after 60 seconds since the previous attempt and after any server backoff. Never send unconditional `no-cache` headers to map tiles.
- Check eligibility when the app becomes active, the selected day changes, or a one-minute foreground scheduler ticks. This timer does not imply one network request per minute.
- Stop timers when backgrounded. Cancel an in-flight weather request when the app leaves active state; cancellation is not a user-visible fetch failure. Reconsider on resume.
- Map movements and place selections never fetch a new national weather layer solely because the location changed.

Use ETag/If-None-Match and Last-Modified/If-Modified-Since when provided. Preserve the original response tuple when unchanged. Do not use ArcGIS object IDs alone as a forecast version: they can be reused.

### Failures and backoff

- All requests have an AbortController and a 15-second timeout.
- No immediate automatic retry chain. After an error, schedule at 1, 2, 4, 8, then 15 minutes, with up to 10% positive jitter, while active. Reset the failure count after success.
- Respect a valid Retry-After on 429/503 if later than local backoff. Parse both delta-seconds and HTTP dates. User taps do not bypass this deadline.
- Treat 403/404 as a likely endpoint/access problem; use at least a 15-minute retry interval and retain a diagnostic error code.
- Manual refresh shows the existing snapshot while refreshing. It never blanks the map.
- Store request state per day, and use a generation token so a late response cannot populate a different day or overwrite a newer snapshot.
- On response acceptance, compare issuance for the same day/valid period and reject older versions. Legitimate progression to a later valid period is allowed. Do not silently roll a newer cached forecast backward because a CDN served an older product.
- A queue entry catches its own exception, updates state, and allows the next day to run.

## 10. UI state model and exact wording

Keep network state (`idle`, `loading`, `refreshing`, `error`) separate from data state. A failed refresh can coexist with valid cached data.

For forecast data, derive temporal state using the injected clock:

- `upcoming`: now is before `validFrom`.
- `valid`: `validFrom <= now < expiresAt`.
- `expired`: now is at or after `expiresAt`.

Derive “check overdue” if a successful check is more than 30 minutes old, or if there is no successful check time. This is an app freshness indicator, not a statement that NOAA has issued a newer forecast. Valid/upcoming cached forecasts may still be displayed and inspected, but the cache warning accompanies the result.

| Condition | Display and behavior |
|---|---|
| No cache, initial request | “Loading Day N outlook…”; controls and map remain usable |
| Valid/upcoming forecast | Issue/valid times; “Checked … ago”; show categories |
| Refresh in progress | Small spinner by Refresh; keep existing content |
| Valid cache, failed update | “Couldn't update. Showing saved outlook.” with check time |
| Check older than 30 min | “Update overdue. Showing saved outlook.” |
| Expired snapshot | “This outlook has expired.”; faded reference overlay; no current point-risk badge |
| Empty valid response | “No outlook geometry returned. Forecast availability could not be confirmed.” |
| No usable cache and error | “Outlook unavailable. Try again or open SPC.” |
| Point matches TSTM | “General thunderstorms”; not “Level 0 of 5” |
| Point matches severe category | “Slight risk · Level 2 of 5”, using the relevant category |
| Point outside all polygons | “Not inside a displayed outlook area.” |
| Missing map tiles | “Background map may be incomplete.”; weather text remains available |
| Storage failure | “Local storage unavailable. Changes may not be saved.” |

Outside-polygon supporting copy:

> This view covers SPC outlooks for the contiguous US. An unshaded point is not a guarantee that severe weather cannot occur.

Keep an expired map unmistakably labeled; do not combine it with a current risk label. Derive expiry on a one-minute timer and immediately on foregrounding, not just when a new response arrives.

Do not label a successful fetch “Live” or “Real time.” Use “Checked.” If a clock appears earlier than a stored check by more than five minutes, suppress relative-age confidence, use absolute times, and show “Device time may be incorrect.” No app can guarantee correctness with an incorrect device clock.

## 11. Map implementation

### 11.1 Native renderer API

Use MapLibre v11 components: `Map`, `Camera`, `GeoJSONSource`, and `Layer`. The map accepts a style JSON object. `GeoJSONSource` accepts normalized data through its `data` prop. Use `Layer` with `type="fill"`, `type="line"`, or `type="circle"`, standard paint properties, and explicit stable IDs.

Avoid v10 tutorial APIs such as `MapView` and `ShapeSource`. Check the installed v11.4.0 types for exact camera and event signatures. Domain geometry must not depend on a rendered-feature query API whose behavior can vary with zoom.

### 11.2 Bundled raster style

Create the map style locally in `basemap.ts`; do not use MapLibre demo tiles or a third-party hosted style as an undeclared dependency.

```json
{
  "version": 8,
  "sources": {
    "osm": {
      "type": "raster",
      "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      "tileSize": 256,
      "maxzoom": 19,
      "attribution": "© OpenStreetMap contributors"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#E8EDF2" }
    },
    {
      "id": "osm-basemap",
      "type": "raster",
      "source": "osm",
      "paint": { "raster-opacity": 1 }
    }
  ]
}
```

No sprite or glyph server is needed for this raster style and circle/line/fill overlays. Raster tile labels are baked into the images; do not assume they can be raised above weather polygons independently.

Keep `BASEMAP_PROVIDER` in one configuration module containing provider ID, tile template, attribution text/URL, tile size, and zoom limit. Allow a development environment override only for explicit fixture/local-test use. No remote configuration service is needed in v0.1; replacing the provider later can be a normal app update.

### 11.3 Request identification and tile policy

Register MapLibre-specific headers **before mounting the first map**. A header on JavaScript `fetch` does not automatically apply to native tile requests.

Use the documented TransformRequestManager entry point, adapting only to the installed type definitions:

```ts
TransformRequestManager.addHeader({
  id: 'osm-app-identification',
  name: 'User-Agent',
  value: 'SPCOutlookPrototype/0.1.0',
  match: /^https:\/\/tile\.openstreetmap\.org\//,
});
```

A contact URL/email is useful later but do not invent a user contact address for the prototype. Keep identification stable. Verify the effective native header on iOS and Android using native request diagnostics or a temporary local test endpoint; never log real location data to an external diagnostic service.

Show visible, linked `© OpenStreetMap contributors` attribution on the map, targeting `https://www.openstreetmap.org/copyright`. Attribution hidden only behind an information icon is insufficient for this design. Also show `Forecast: NOAA/NWS SPC`, with the official outlook link in Details.

Use normal native HTTP caching; verify it honors response expiry and revalidation. If expiry headers cannot be interpreted, enforce a seven-day tile cache freshness floor per OSM policy. Never globally disable caching or call native cache-clearing methods on each launch. Do not call offline-pack APIs or prefetch regions/zoom levels. If native defaults prefetch broad areas, disable that behavior and document the configuration. Normal viewport rendering is the only required tile-fetch behavior.

If the selected native version cannot be made compliant, disable public tile fetching and report the specific integration blocker while continuing with a local synthetic basemap for development. Do not claim a fully working live-map prototype until compliance and live rendering are demonstrated. Do not switch to a paid service or scrape tiles as a workaround.

### 11.4 Camera and rendering

- First-run national bounds: west -125, south 24, east -66, north 50; fit with 20 logical units of padding inside the actual map frame.
- Clamp interactive zoom to 2–10. This is a forecast map, not street navigation.
- Keep north up and pitch zero; disable rotation and pitch gestures.
- Retain pan/zoom across day changes and data refreshes.
- US view explicitly restores national bounds.
- Selecting a saved place or obtaining location centers at zoom 7 without changing selected forecast day.
- Account for the space occupied by the header, summary, and tab bar. Prefer a physically smaller map frame to complicated overlay insets.
- Keep the map instance mounted when data updates; replace the source data without recreating the native map.

Render one source for the selected outlook. Add per-category fill and line layers from lowest to highest rank, then the selection marker above all outlook layers. Default fill opacity is 0.35, with 1.5-unit category outlines. Higher ranks draw last. Overlapping translucent colors can blend, so the textual lookup and legend remain authoritative; verify all categories remain distinguishable in dense fixtures. Do not derive point risk by sampling rendered colors.

For expired reference data, reduce fill opacity to 0.12 and use muted dashed outlines. A persistent Expired banner must accompany it. For empty/missing data, remove the weather source entirely.

Use a circle layer for the selected coordinate, with a dark outline and light inner ring. Keep exact numerical coordinates for lookup; display four decimal places. Tapping map UI buttons must not also select the coordinate underneath them. A single `Map.onPress` handler should own point selection, avoiding source/map event duplication.

Map errors and weather errors are independent. Subscribe to the available native map/resource error signals, debounce repetitive tile messages, and retain usable text. `onDidFinishLoadingStyle` alone is not proof that all raster tiles loaded. Verify failed tile behavior in the integration check.

## 12. Screen implementation details

### 12.1 Map screen

Layout in order: safe-area header, segmented day control, check-status row, flexible map frame, summary panel, tab bar.

- Header title: SPC Outlook; Info action opens About & data.
- Day controls always available. Selected state uses underline/background and screen-reader selected state.
- Under each day, show the calendar date of its valid start in the device timezone when known. The Details screen includes both endpoints. Do not manufacture a date by adding N to today.
- Refresh affects the selected day and obeys the scheduler. Disable while its request is in flight or a minimum/backoff deadline applies. Explain a blocked retry with “Try again in …”.
- With no point selected: “Tap the map to inspect a place.” Show national maximum category only if explicitly labeled “Highest category in this outlook”; omitting this extra statistic is the default.
- Selected point summary: name or “Selected point,” coordinates, category/availability, valid period, Save/Edit action, and Details.
- Forecast details remain available without a selected point.
- Do not show modal dialogs on automatic refresh failures; use the status row/banner.

### 12.2 Places screen

List places ordered by creation time ascending. No drag reordering in v0.1. A place row shows its name, coordinates, Day 1 result, and relevant freshness/valid-period qualifier. Use cached/in-memory Day 1 data; rendering 20 rows must not create 20 network requests.

Tapping a row sets the selection, returns to Map, and centers that point. Retain the current selected outlook day; the row's Day 1 label makes its own summary unambiguous. If the point's displayed result differs after navigation to Day 2/3, the Map day control and date explain why.

Expose separate Edit and Delete buttons rather than relying on a swipe gesture. Delete asks once for confirmation because it removes a saved place; do not add confirmation for routine reading or navigation. Deleting the selected saved place converts it to an unsaved selected point, preserving the coordinates.

### 12.3 Place editor

Route with either an existing place ID or selected coordinates from app state. Validate missing/invalid parameters and return gracefully to Map; never create a place at `(0,0)` as a fallback.

- Name: trim whitespace; 1–40 Unicode code points; no multiline/control characters.
- Coordinates: inherited from selected point, shown read-only.
- Default new name: “Place 1,” incrementing to the next unused default name.
- Duplicate user-entered names are allowed; coordinates distinguish them.
- A second save of the currently selected saved ID edits that place rather than duplicating it.
- At 20 records, show “You can save up to 20 places. Delete one to add another.” Existing edits still work.
- Save is disabled while invalid or pending. Avoid double-submit records.
- On success, persist, update context, select the saved ID, and close the modal.
- A failed write keeps the editor open with the entered name intact.
- Cancel closes without saving. Android Back and iOS dismiss have the same behavior.

### 12.4 Legend

Show all six categories, their names and severe-risk levels, and a compact explanation:

> Categories summarize the SPC severe-weather outlook for a forecast period. They do not describe a current warning or guarantee conditions at an exact address.

Explain that General thunderstorms is separate from the five severe-risk levels. Do not invent fixed probability percentages for each category; category definitions involve hazard-specific thresholds not implemented in v0.1.

### 12.5 Forecast details

Show day, selected-point result if available, issued time, valid start/end, successful check time, cache status, and source. Show local times with a timezone abbreviation and a separate UTC line. Use `Intl.DateTimeFormat` with the device timezone; a range spanning a DST change must render correct offsets for each endpoint.

Include Open official SPC outlook. Any explanatory app text must be visually separate from source facts. No generated forecast narrative.

### 12.6 About & data

Include:

- “Independent viewer of NOAA/NWS Storm Prediction Center outlooks. Not affiliated with or endorsed by NOAA.”
- “This app displays outlooks and does not provide emergency warnings.”
- “Saved places stay on this device. Location is optional. Map and data providers receive ordinary network requests.”
- A short explanation of forecast versus map caching.
- NOAA/NWS/SPC and OSM source links.
- App version `0.1.0` and a development-build label when applicable.
- Clear cached forecasts, with confirmation; preserve places and map-tile cache.

After clearing forecasts, clear in-memory weather data and validators, then run the normal refresh process. If offline, display unavailable rather than resurrecting deleted cache data.

## 13. Device-location implementation

Use `expo-location` only after Locate me is pressed:

1. Read foreground permission state.
2. If undetermined, request it with the configured purpose text.
3. If denied, show “Location access is off. You can still tap the map.” Provide Open settings only if the permission cannot be requested again.
4. Check location-service availability and handle disabled services.
5. Request one current fix at balanced accuracy; show an in-button spinner.
6. Apply a 15-second application timeout and an operation ID. If the native request cannot be canceled, ignore any completion after timeout or a newer selection.
7. On success, validate coordinates, select the point, center the map, and stop loading. Do not save it automatically.
8. If a manual point/place selection occurs while location is pending, invalidate the pending location result so it cannot move the map unexpectedly.

Do not keep a live location watch. Approximate permission is sufficient; if the returned accuracy is worse than 1 km, display an Approximate location qualifier. Do not round coordinates before risk lookup or claim a precise address. Unit-test the location wrapper with mocked permissions/results; simulator location must be set explicitly during manual testing.

## 14. Styling and accessibility specification

Starting tokens:

```ts
const colors = {
  background: '#F3F5F7',
  surface: '#FFFFFF',
  text: '#17202A',
  secondaryText: '#52606D',
  border: '#D6DEE6',
  accent: '#2457A7',
  warningBackground: '#FFF3CD',
  errorText: '#A61B1B',
};
const spacing = [4, 8, 12, 16, 24, 32];
```

Use system fonts and React Native StyleSheet. Body 16, secondary text 14, screen title 22, risk title 20 as starting sizes. Respect system scaling. Cards use 12-unit corner radius, modest borders, and minimal shadow. Avoid fixed card heights that clip large text.

All interactive elements have accessibility labels and appropriate button/tab roles. Day controls announce selected state. Use a text badge plus color; never convey category, failure, or selection by color alone. Keep contrast legible on category badges by using dark text or a neutral text area rather than white text on yellow/green.

Use 48-unit minimum interactive targets. Support VoiceOver and TalkBack navigation of forecast information, saved places, and actions without requiring map gestures. Mark complex map geometry as one accessible region with instructions rather than exposing hundreds of polygon vertices. Provide selected-place coordinates and risk in ordinary text outside the map.

Modals announce their title, focus their first meaningful control, and offer a labeled Close action. Preserve reading order and keyboard avoidance in the name editor. Status announcements should occur on meaningful user-triggered changes; do not read the whole screen every minute.

## 15. Error boundaries and diagnostics

Add a root error boundary with a Retry screen and a separate map boundary where React errors can be isolated. Native renderer crashes require real-device investigation; an error boundary cannot guarantee recovery from native crashes.

Use structured development logs: event name, day, request duration, HTTP status, feature count, issue/valid tuple, and error category. Never log saved place names or device coordinates. No remote logging SDK. Deduplicate repeated map-tile errors to prevent unbounded log noise.

Useful error codes: `HTTP_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `CANCELED`, `INVALID_JSON`, `INVALID_GEOMETRY`, `UNSUPPORTED_CATEGORY`, `INVALID_TIMESTAMPS`, `MIXED_PRODUCT`, `INCOMPLETE_RESPONSE`, `RESPONSE_TOO_LARGE`, `OLDER_PRODUCT`, `STORAGE_ERROR`, `LOCATION_DENIED`, `LOCATION_UNAVAILABLE`.

UI copy should be understandable without exposing raw exceptions. Development logs preserve the actionable technical cause. Links are fixed configuration values, never arbitrary URLs supplied by a feed property.

## 16. Fixtures and reproducible development

Create `scripts/capture-outlook-fixtures.mjs` to fetch each of the three configured endpoints once, validate successful HTTP/JSON, and write fixtures plus a manifest recording source URL, retrieval time, and source issue/valid times. Do not run it automatically in unit tests or on every build. A normal capture is three requests, not a crawl.

Keep a small captured fixture for each day and clearly synthetic fixtures for exceptional cases. Synthetic fixtures can use simple squares and holes; they must not be presented as current NOAA forecasts.

Required synthetic fixture cases:

- All six category levels with overlapping areas.
- Polygon with a hole and a MultiPolygon with separate parts.
- Point exactly on a boundary and outside all geometry.
- Empty FeatureCollection.
- Invalid JSON/top-level ArcGIS error.
- Missing or malformed timestamp, mixed issue times, and expired forecast.
- Unknown category and conflicting `dn`/label.
- Incomplete response and malformed/null geometry.

Provide an explicitly enabled development fixture mode (`EXPO_PUBLIC_DATA_MODE=fixtures`) and default to live mode when unset. Fixture mode uses an injected fixed clock and local data; it shows a persistent “DEMO DATA — NOT CURRENT WEATHER” banner. Unit tests inject fixtures directly and never need this environment flag. Never automatically fall back to fixtures after a live failure.

Use a bundled background-only map style in fixture mode by default so automated UI tests do not consume public tiles. A developer can deliberately run the live-map smoke check separately. Provide the exact fixture reference time in the manifest and app diagnostics.

## 17. Automated verification

Use `jest-expo` and React Native Testing Library. Mock native MapLibre, location, and storage boundaries for JavaScript tests, but keep parsing, time calculations, request scheduling, and point lookup real. Test behavior, not snapshots of component implementation details.

### Domain tests

1. Strict UTC parser handles month/year rollover, leap days, and rejects impossible dates.
2. Day 1 observed 12-digit timestamps normalize correctly independent of device timezone.
3. `dn` values map to the correct category/rank; High is rank 5.
4. Polygon holes, MultiPolygons, overlaps, and boundary inclusion produce correct results.
5. Highest matching rank wins regardless of response feature order.
6. General thunderstorms is distinct from no matching polygon and from missing data.
7. Empty/invalid/incomplete payloads never produce an all-clear result.
8. Mixed forecast tuples invalidate the complete snapshot.
9. Expiry occurs exactly at `expiresAt`; future-valid forecasts remain inspectable as forecasts for that period.
10. Time formatting works across UTC/local-date differences and daylight-saving transitions.
11. An older response does not overwrite a newer accepted issuance.

### Repository/scheduler tests

1. Cold start hydrates cache before network completion.
2. A failed refresh retains the prior valid snapshot and original issue time.
3. A 304 updates check time but preserves downloaded time and body.
4. A 304 without cache initiates only one unconditional recovery request.
5. Empty success removes the active prior overlay and disables point assessment.
6. Multiple consumers deduplicate to one request; concurrency stays at one.
7. Switching days during a request cannot populate the wrong screen.
8. HTTP freshness, manual throttling, Retry-After, backoff, and cancellation are respected.
9. Foreground/background changes clean up timers and do not create duplicate schedulers.
10. `no-store` prevents durable response storage; corrupt weather rows do not delete places.
11. Database write failure leaves unsaved place edits intact.
12. Clearing cache clears validators and in-memory data while preserving places.

### Interaction tests

1. Day selection changes dataset and label while preserving selected point.
2. Map tap produces textual category details.
3. Save, rename, delete, maximum-count, and failed-save paths behave as specified.
4. Permission denial leaves the app usable.
5. A late location fix cannot override a subsequent manual selection.
6. Expired and unavailable states suppress current-risk badges.
7. Refresh is visibly pending and disabled during its request/backoff window.
8. Required attribution, source links, modal close actions, and screen-reader labels exist.

Unit tests do not prove native map rendering, HTTP cache policy, actual SQLite persistence, or location permission configuration. Those require the next section.

## 18. Native and manual acceptance matrix

Run on iOS Simulator and Android Emulator at minimum when installed, then one physical device if available. Record model/runtime/OS, app commit or working-tree state, date, and result in `docs/VALIDATION.md`. Missing hardware is a documented gap, not a passed check.

| Scenario | Expected evidence |
|---|---|
| Clean install, live network | Day 1 live polygons, attribution, dates, and responsive map |
| Day 1/2/3 switching | Correct corresponding source timestamps; no old-day overlay flash |
| Compare against official SPC | Matching broad boundaries, categories, and valid periods for the same issuance |
| Save and force-close/relaunch | Place name/coordinates and cached forecast persist through actual SQLite |
| Airplane mode after viewing | Cached weather remains labeled; missing map tiles handled without false data |
| Offline on first launch | Unavailable state with no invented forecast |
| Expired fixture | Expired label and disabled current assessment |
| Feed timeout/invalid JSON | Saved data retained; readable error; no immediate request storm |
| HTTP 429 with Retry-After | Retry action honors the deadline |
| OSM header check | Native requests identify the application on both platforms |
| OSM cache check | Revisit/relaunch reuses or conditionally validates tiles according to headers |
| Location denied/unavailable | Manual map browsing and saved places work |
| Location granted | One location lookup; no background service/watch |
| Small phone and 200% text | No clipped required controls; modals and lists scroll |
| VoiceOver/TalkBack | Forecast details and saved-place operations accessible |
| Map source outage | Forecast text still usable; map availability qualified |
| Background/foreground repeatedly | No duplicate timers or repeated unnecessary requests |

Performance targets are development acceptance goals, not service guarantees: cached text should appear within one second after JS/database initialization; day switching from cache should respond within about 250 ms on a representative device; map gestures should remain smooth during refresh. Measure and record obvious regressions. Do not block forever waiting for a public network response to satisfy a time target.

Check native manifests for foreground-only location. Verify the app works without an Expo account or any paid API key. Distinguish a Metro development server on the developer's machine from a production backend: it serves development code during testing and is not a hosted service required by the finished app.

## 19. Ordered implementation work packages

### A. Bootstrap and native proof

- [ ] Inspect environment and preserve repository documents.
- [ ] Generate the Expo 56 app and resolve dependency versions.
- [ ] Configure app identity, Router, plugins, and foreground permissions.
- [ ] Run type checks and Expo dependency diagnostics.
- [ ] Complete the early native map integration check in section 5.
- [ ] Record installed versions and verified/unverified platforms.

Exit condition: native app opens with OSM and a test polygon; public requests are identified and caching has been checked. If native setup is blocked, continue pure modules but keep this gate visibly incomplete.

### B. Feed adapter and domain logic

- [ ] Build source configuration and development feed probe.
- [ ] Capture actual Day 1–3 fixtures with source/time manifest.
- [ ] Implement strict UTC parsing and category configuration.
- [ ] Implement geometry/schema validation and normalized snapshots.
- [ ] Implement highest-category point lookup and temporal state.
- [ ] Pass domain correctness tests.

Exit condition: real samples and synthetic edge cases yield the specified normalized states without UI dependencies.

### C. Persistence and fetching

- [ ] Implement SQLite migration and repositories.
- [ ] Implement weather transport, timeout, validators, and bounded response handling.
- [ ] Implement queue, scheduling, backoff, cancellation, and last-good retention.
- [ ] Add forecast context/hook and hydration flow.
- [ ] Pass repository/scheduler tests.

Exit condition: cache survives actual app restart, failures retain good data, and there are no duplicate/rapid retries.

### D. Complete map experience

- [ ] Add source/layers and selected-coordinate marker.
- [ ] Add day selector, refresh, status, camera actions, and point summary.
- [ ] Implement loading/empty/error/upcoming/valid/expired states.
- [ ] Add Legend and Forecast details with correct local/UTC formatting.
- [ ] Verify against official outlooks for matching issuances.

Exit condition: all three days can be inspected live and from cache, with accessible text and accurate timestamps.

### E. Places, location, and About

- [ ] Implement places persistence, list, selection, editor, and deletion.
- [ ] Implement one-shot optional location and race protection.
- [ ] Implement About, trusted source links, and cache clearing.
- [ ] Add interaction tests and large-text/screen-reader adjustments.

Exit condition: complete primary user journeys work without an account or mandatory location permission.

### F. Validation and handoff

- [ ] Run `npm run check`, `npx expo install --check`, and `npx expo-doctor`.
- [ ] Build and run both native targets when toolchains are available.
- [ ] Complete manual acceptance matrix, recording real evidence.
- [ ] Remove scaffold demos, unused packages, debug-only mistakes, and misleading sample data.
- [ ] Review source documentation against section 4.1; explain important contracts and non-obvious behavior, and remove stale comments.
- [ ] Write README, implementation notes, and validation report.
- [ ] Review `git diff` for unintended changes; do not publish or push.

Exit condition: v0.1 is locally reproducible, the live main flow works, correctness tests pass, and all remaining environmental limitations are explicitly documented.

## 20. Required handoff documentation

`README.md` must include:

- Product purpose and v0.1 scope.
- Exact tested Node/npm, Expo, React, React Native, MapLibre, Xcode, and Android toolchain versions.
- `npm ci` setup and native prerequisites.
- `npm run ios`, `npm run android`, and `npm start` usage.
- Physical-device development instructions when verified; do not request store publication.
- The fact that Expo Go is unsupported for this map stack.
- Live endpoints, OSM policy/attribution, and absence of required API keys/backend.
- Fixture-mode command, reference time, and visible demo warning.
- Test commands and how to capture new fixtures responsibly.
- Known limits, especially missing tiles offline and absence of warnings/notifications.

`docs/IMPLEMENTATION_NOTES.md` must include resolved versions, any departures from this plan, source schema observations, and native map header/cache verification method.

`docs/VALIDATION.md` must distinguish automated tests, real native runs, manual checks, and unverified items. Include screenshots where practical, stored as local development artifacts, but do not claim screenshots prove data correctness. Report unresolved issues with concrete reproduction steps.

## 21. Definition of done

All required work packages are complete, with these behaviors demonstrated:

1. Live Day 1–3 categorical outlooks render with correct attribution and times.
2. Point lookup handles nested areas, holes, and MultiPolygons correctly.
3. Saved places survive process death and can be edited/deleted.
4. Device location is optional, foreground-only, and cannot overwrite a later selection.
5. Weather caching survives restart and handles error, expiry, empty, and invalid responses safely.
6. OSM tile requests are identifiable and comply with caching/no-bulk-download requirements.
7. The app provides accessible text for all essential weather information.
8. No cloud account, paid API, server, secret, ads, or purchases are required.
9. Tests and available native validation pass; any unverified platform is clearly reported.
10. The next developer can run the project from the README without rediscovering architectural choices.
11. Source code meets section 4.1: meaningful APIs have useful documentation comments, important domain assumptions and lifecycle behavior are explained, and comments match the implemented behavior.

Do not call a fixture-only mockup or an unbuilt collection of screens “v0.1 complete.” A working first platform with a missing second toolchain is useful progress, but the validation report must state that the second platform remains unverified.

## 22. Primary references and evidence

References were checked on September 24, 2026. Their role is to support integration details; application policies such as the 15-minute refresh interval, local place limit, and UI copy are decisions in this plan rather than NOAA requirements.

- [NOAA SPC outlook service](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer)
- [Day 1 field schema](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/1)
- [Day 2 field schema](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/9)
- [Day 3 field schema](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/17)
- [NWS data usage policy](https://www.weather.gov/disclaimer)
- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [OSM attribution/copyright](https://www.openstreetmap.org/copyright)
- [Expo SDK/version compatibility](https://docs.expo.dev/versions/latest/)
- [Expo local build workflow](https://docs.expo.dev/guides/local-app-development/)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo Jest setup](https://docs.expo.dev/develop/unit-testing/)
- [MapLibre package 11.4.0 metadata](https://registry.npmjs.org/@maplibre/maplibre-react-native/11.4.0)
- [Verified Expo SDK 56 template metadata](https://registry.npmjs.org/expo-template-default/56.0.36)
- [MapLibre Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
- [MapLibre v11 migration](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/)
- [Map component](https://maplibre.org/maplibre-react-native/docs/components/map/)
- [Camera component](https://maplibre.org/maplibre-react-native/docs/components/camera/)
- [GeoJSON source](https://maplibre.org/maplibre-react-native/docs/components/sources/geo-json-source/)
- [Layer component](https://maplibre.org/maplibre-react-native/docs/components/layer/)
- [TransformRequestManager](https://maplibre.org/maplibre-react-native/docs/modules/transform-request-manager/)
- [Turf point-in-polygon](https://turfjs.org/docs/api/booleanPointInPolygon)

Live data preparation checks returned FeatureCollections for all three configured layers, with the compact UTC timestamp format and Polygon/MultiPolygon geometry documented above. They did not validate native rendering or promise future upstream availability. Those checks remain explicit implementation tasks.

The published MapLibre 11.4.0 package was inspected as well: it exports the v11 map/source/layer components and `TransformRequestManager`, and its `addHeader` options accept the ID, name, value, and URL match used in this plan. The example therefore targets the pinned package, rather than assuming the website's latest API exists in an older release.
