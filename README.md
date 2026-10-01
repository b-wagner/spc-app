# SPC Outlook

A native iOS/Android prototype for NOAA/NWS Storm Prediction Center Day 1–3 categorical outlooks. Browse polygons, inspect a point, search for a contiguous-U.S. city/place or ZIP code, optionally locate yourself, read the official Forecast Discussion, and save up to 20 places locally. The app distinguishes forecast validity, last successful check, upcoming periods, expired data, and unavailable data. It provides no emergency warnings or notifications.

## Project structure

New to React Native or Expo? Start with the [beginner-friendly project structure guide](docs/PROJECT_STRUCTURE.md). It explains screens, components, shared state, forecast logic, assets, tests, configuration, and how a map tap flows through the code. Its directory inventory includes only tracked or non-ignored files and folders.

## Run locally

Use Node **22.23.3** (`.nvmrc`) and npm **10.9.9**. No API keys, Expo account, or hosted backend are required.

```sh
npm ci
npm run ios      # macOS, Xcode and CocoaPods; generates native project and builds
npm run android  # Android Studio/SDK, JDK and emulator or attached device
npm start       # Metro for an already-installed development build
```

**Expo Go is unsupported:** MapLibre requires this project's native development build. `ios/` and `android/` are generated and ignored; native customizations live in app configuration, config plugins, and the postinstall patch. The first iOS build compiles React Native from source and can take several minutes. After running `npm ci` again in an existing checkout with a generated iOS project, run `(cd ios && pod install)` before rebuilding. CocoaPods recreates native dependency files (including Expo SQLite headers) that a clean npm install removes; retrying the build alone may not restore them.

Tested: Expo **56.0.22**, React **19.2.3**, React Native **0.85.3**, MapLibre React Native **11.4.0**, Xcode **27.0 (27A266a)**, CocoaPods **1.17.0**, Ruby **3.4.5**, iPhone 18 Pro simulator / iOS **27.0**. The exact dependency resolution is in `package-lock.json`. Android native execution was not verified: this machine has no JDK, Android SDK, emulator, or Android Studio. The generated Android configuration uses Gradle 9.3.1, AGP 8.12.0, compile/target SDK 36, build tools 36.0.0 and NDK 27.1.12297006 (minimum SDK 24); provision a compatible Android toolchain before running it.

On this Mac, Metro needed IPv4-first DNS when using localhost:

```sh
NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --dev-client --localhost
```

Use the development client to open the Metro URL. After changing the Hermes configuration or Babel settings, restart Metro with `--clear` and rebuild the native app when native settings changed. Temporary toolchain downloads used during implementation are not part of the project; install Node and CocoaPods on your normal PATH for subsequent sessions. Physical-device builds/signing and connectivity have not been validated.

## Data and offline behavior

The app requests the full national GeoJSON layer from [NOAA's SPC outlook service](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer): layers **1, 9, 17** for Days 1, 2, 3, with `where=1=1`, explicit fields, `returnGeometry=true`, `outSR=4326`, `f=geojson`. Point lookup is on-device; saved names and selected coordinates are not sent to NOAA.

The map camera is constrained to the contiguous United States with native MapLibre bounds and zoom levels 2–12. Explicit location searches use the public [Nominatim service](https://nominatim.org/release-docs/latest/api/Search/) with a U.S. country filter and lower-48 bounding box. Search is submit-only (not autocomplete), limited to five results, rate-limited to one public request per second, cached in memory for 24 hours, and visibly attributed to OpenStreetMap. No API key is required. Search terms and ordinary network metadata are sent to Nominatim; saved names are not. The Forecast Discussion screen retrieves SPC's official plain-text `day1otlk.txt`, `day2otlk.txt`, or `day3otlk.txt` product on demand and renders no provider markup.

The categorical ArcGIS layer does **not** publish population, larger population centers, or a documented square-mile value. Its geometry area field is tied to a geographic coordinate system and is not contracted as square miles. The SPC website's presentation pages display impact tables, but they are not part of the documented data API and are not scraped here. Those values are therefore omitted rather than estimated or mislabeled.

The basemap uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible **© OpenStreetMap contributors** attribution and application User-Agent `SPCOutlookPrototype/0.2.0`. Native tile caching respects response freshness and validators. Prefetch is disabled; no bulk download or offline-region feature exists. Follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). Tile requests disclose the viewed area and ordinary network metadata to the provider.

Weather snapshots and places use SQLite. Cached weather can remain available offline, but never guarantees that map tiles are available. Expired data cannot produce a current point assessment. Clearing the weather cache preserves saved places and the separate native basemap cache. There is no background tracking, account sync, analytics, paid API, radar, warning feed, or push notification service.

## Tests and historical fixtures

```sh
npm run check       # TypeScript, lint, 76 domain/storage/network/UI tests
npm run test:ci
npx expo-doctor
EXPO_PUBLIC_DATA_MODE=fixtures npm start
```

Fixture mode uses captured September 24, 2026 NOAA responses and a fixed reference clock of **2026-09-24 18:00 UTC**. Every screen identifies demo data as **NOT CURRENT WEATHER**. It uses an in-memory weather repository and a blank basemap by default. A live failure never switches to fixtures. Stop Metro and remove the environment variable to return to live mode; no env file is required.

`node scripts/check-outlook-feeds.mjs` checks the three live layer schemas. `node scripts/capture-outlook-fixtures.mjs` deliberately makes three national requests and replaces fixture files and their manifest. Run sparingly, inspect every captured response, and adjust fixture expectations/reference time intentionally; do not run as a polling job.

For local native tile diagnostics, run `node scripts/tile-diagnostics.mjs`, then start fixture Metro with `EXPO_PUBLIC_TEST_TILE_URL='http://127.0.0.1:8123/fresh/{z}/{x}/{y}.png'`. This development-only loopback override serves synthetic tiles, never proxies OSM, and logs request headers. `/fresh/` returns one-hour freshness; other prefixes return zero freshness for conditional-request checks. Restart Metro without the variable afterward.

See [implementation notes](docs/IMPLEMENTATION_NOTES.md) for compatibility workarounds and [validation](docs/VALIDATION.md) for observed results and remaining gaps. The original [implementation plan](IMPLEMENTATION_V0_1.md) and [product design](PRODUCT_DESIGN.md) remain intact.
