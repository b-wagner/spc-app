# A beginner's guide to the project

This guide covers files already tracked by Git or eligible to be tracked under the repository's ignore rules. It intentionally leaves ignored build output, generated platform projects, downloaded dependencies, and local development state out of the directory inventory. Folder paths below are relative to the project root unless a section says otherwise.

Most changes to the app happen in `src/`. Bundled images belong in `assets/`. The same React Native source serves both iOS and Android.

## How React Native and Expo fit together

**React** describes an interface as reusable components. A component can be a button, a forecast card, or an entire screen. **React Native** displays those components using native mobile views. **Expo** provides development tools, native integrations, and configuration for building and running the app. This project uses **Expo Router** to connect screen files to navigation destinations, called routes.

Useful terms while reading the code:

| Term or extension | Meaning in this project |
|---|---|
| `.ts` | TypeScript: JavaScript with type checking. Used for logic and data definitions. |
| `.tsx` | TypeScript that can contain JSX, the markup describing React interfaces. |
| `.js`, `.mjs` | JavaScript configuration or scripts; `.mjs` explicitly uses JavaScript modules. |
| `.json` | Structured data or configuration. |
| Component | A reusable piece of interface, commonly a function returning JSX. |
| State | Data that changes while the app runs, such as the selected forecast day. |
| Provider | A component that makes shared data and actions available to components beneath it. |
| Hook | A React function such as `useOutlook()` that gives components access to state or behavior. |
| Repository | Code managing access to stored data or acceptance of incoming data. |
| Fixture | A predictable sample input for testing or explicitly labeled demo use. |
| Migration | A controlled change to the database's structure. |

## Top-level layout

```text
spc/
├── src/                       Shared application source
│   ├── app/                   Screens and navigation
│   ├── components/            Reusable interface components
│   ├── features/              Code grouped by app capability
│   ├── storage/               Database initialization and migrations
│   ├── theme/                 Shared colors and styles
│   └── utils/                 Formatting, clock, and error helpers
├── assets/                    Bundled images
├── test/                      Automated tests and sample data
├── plugins/                   Native project configuration customizations
├── scripts/                   Development and diagnostic utilities
├── docs/                      Guides, implementation notes, and evidence
├── .gitignore                 Rules for excluding files from Git
├── .nvmrc                     Node.js version for development
├── app.json                   Expo app configuration
├── package.json               Libraries and development commands
├── package-lock.json          Exact dependency resolution
├── tsconfig.json              TypeScript configuration
├── babel.config.js            JavaScript transformation configuration
├── eslint.config.js           Static code-checking configuration
├── jest.config.js             Automated test configuration
├── README.md                  Setup and run instructions
├── PRODUCT_DESIGN.md          Product behavior and design requirements
└── IMPLEMENTATION_V0_1.md      Implementation requirements and acceptance plan
```

## Screens and navigation: `src/app/`

```text
src/app/
├── _layout.tsx                App-wide providers and navigation
├── (tabs)/
│   ├── _layout.tsx            Defines Map and Places tabs
│   ├── index.tsx              Main Map screen
│   └── places.tsx             Saved Places screen
├── about.tsx                  About, privacy, sources, and cache controls
├── legend.tsx                 Category explanations
├── outlook-details.tsx        Forecast times and source details
└── place-edit.tsx             Save or edit a place
```

The root [layout](../src/app/_layout.tsx) connects shared storage, places, and forecast providers. It also configures navigation to secondary screens presented as modals—screens shown over the main tab interface.

The `(tabs)` parentheses mark an Expo Router route group. The group organizes screens without adding its name to their route paths. Its `_layout.tsx` defines the tab bar; `index.tsx` is the default destination in that group. Layout files configure the surrounding navigation and shared setup, while screen files compose the visible interface.

The [Map screen](../src/app/(tabs)/index.tsx) brings together the day selector, map, location controls, status messages, and forecast summary. It delegates downloading, database writes, and geometry calculations to the feature modules.

## Reusable interface: `src/components/`

| File | Purpose |
|---|---|
| `AppButton.tsx` | Shared button appearance, interaction states, and accessibility labels. |
| `ForecastDaySelector.tsx` | Day 1–3 controls and dates derived from the forecast's valid period. |
| `ForecastSummary.tsx` | Selected point, forecast category, validity, and save/details actions. |
| `RiskBadge.tsx` | Category text and color, with unavailable/expired data handled explicitly. |
| `StatusBanner.tsx` | Readable status messages. |
| `DemoBanner.tsx` | Warning that historical fixture data is not current weather. |
| `ExternalLink.tsx` | Opens links supplied by app configuration and handles opening failures. |
| `ScreenErrorBoundary.tsx` | Displays a fallback if a React component fails while rendering. |

Changing [AppButton](../src/components/AppButton.tsx), for example, changes the shared button design across its callers. Components used only by a particular feature can live with that feature instead; `PlaceRow.tsx` is one example.

## App capabilities: `src/features/`

### Forecasts: `outlooks/`

This is the main data-processing area. NOAA data crosses a validation boundary before the interface uses it.

| File | Responsibility |
|---|---|
| `sourceConfig.ts` | NOAA service URLs, day-to-layer mapping, requested fields, and official SPC links. |
| `client.ts` | HTTP requests, timeouts, response metadata, and conditional-request headers. |
| `normalize.ts` | Validate external responses and cached snapshots; preserve polygon geometry. |
| `types.ts` | Data shapes and meanings, including coordinate order, category ranks, and timestamps. |
| `categories.ts` | Category names, severity ordering, and the app's color palette. |
| `timestamps.ts` | Parse NOAA's UTC timestamp format. |
| `repository.ts` | Define weather storage operations and accept responses while rejecting older products. |
| `scheduler.ts` | Coordinate requests, refresh eligibility, retries, cancellation, and cache writes. |
| `pointRisk.ts` | Find the highest category covering a coordinate, including boundary and overlap rules. |
| `validity.ts` | Derive upcoming, valid, expired, and unavailable states and applicable point assessments. |
| `OutlookProvider.tsx` | Share forecast state and own the foreground refresh lifecycle. |
| `useOutlook.ts` | Re-export the hook screens use to access the provider. |
| `fixtures.ts` | Supply historical sample responses in explicitly enabled demo mode. |

The provider and scheduler are shared by the Map screen and saved-place rows. Each row does not download its own forecast. Point inspection happens on the device using the downloaded national polygons.

### Map: `map/`

| File | Responsibility |
|---|---|
| `OutlookMap.native.tsx` | Native MapLibre integration, camera updates, map taps, and renderer events. |
| `OutlookMap.tsx` | Re-export the native implementation for shared imports/type resolution. |
| `layers.tsx` | Turn validated outlook polygons into ordered fill and outline layers. |
| `SelectedPoint.tsx` | Draw the selected coordinate marker. |
| `basemap.ts` | Define the raster map style, provider details, and development diagnostic override. |
| `camera.ts` | Shared national bounds and map padding. |
| `requestHeaders.ts` | Identify the app on native tile requests. |

The `.native.tsx` suffix identifies an implementation intended for native mobile platforms. It does not mean this file contains Swift or Kotlin: it is still a React Native component written in TypeScript.

The map displays validated data supplied by the forecast system. It does not independently download NOAA forecasts or decide a point's risk from screen pixels.

### Saved places, location, and preferences

| Folder and file | Responsibility |
|---|---|
| `places/types.ts` | Saved-place records and the current selection's data shape. |
| `places/repository.ts` | Database reads/writes, name validation, and the 20-place limit. |
| `places/PlacesProvider.tsx` | Shared places, current selection, camera preferences, and location coordination. |
| `places/PlaceRow.tsx` | One saved place's forecast text and selection/edit/delete controls. |
| `location/locateOnce.ts` | Optional one-time foreground location, permission handling, timeout, and cancellation. |
| `settings/repository.ts` | Store and validate camera position and selected saved-place preference. |

A selected point is not automatically a saved place. The user must choose Save place. A delayed location response must not overwrite a newer manual selection.

## Storage, style, and shared helpers

| File | Responsibility |
|---|---|
| `src/storage/database.ts` | Open SQLite and provide durable weather-cache operations. |
| `src/storage/migrations.ts` | Create or upgrade the database structure safely. |
| `src/storage/StorageProvider.tsx` | Share the database connection and report storage availability. |
| `src/theme/tokens.ts` | Shared colors, text styles, spacing, and reusable layout styles. |
| `src/utils/format.ts` | Format dates, coordinates, and last-checked labels for display. |
| `src/utils/clock.ts` | Supply the current time or the fixed historical demo clock. |
| `src/utils/errors.ts` | Represent operational errors with codes the interface can translate. |
| `src/utils/http.ts` | Read untrusted HTTP bodies with provider-specific byte ceilings and streaming cancellation where supported. |

SQLite is an on-device database. These source files describe how it works; actual saved places and cached weather are created on the phone and are not repository assets.

## Images, sample data, and evidence

These serve three different purposes:

| Location | Purpose |
|---|---|
| `assets/icon.png` | App icon bundled into the application, referenced by `app.json`. |
| `test/fixtures/day1.json`, `day2.json`, `day3.json` | Historical NOAA responses used by tests and explicit demo mode. |
| `test/fixtures/manifest.json` | Fixture source URLs, capture times, sizes, and issuance metadata. |
| `test/fixtures/synthetic.ts` | Handcrafted forecast data for cases such as category overlap and geometry boundaries. |
| `docs/evidence/` | Screenshots, recorded tile requests, and dependency versions supporting validation. |

The evidence folder currently contains `day2-selected.png`, `live-day1-location.png`, `large-text-summary.png`, `ios-tile-requests.jsonl`, and `dependency-versions.txt`. These are development records, not images or data displayed by the normal app.

The live map is assembled from downloaded OSM tiles and NOAA polygons. There is no bundled nationwide map image. Future bundled illustrations can go in `assets/`; test inputs belong with fixtures, and validation screenshots belong with evidence.

## Tests: `test/`

| File | What it checks |
|---|---|
| `domain.test.ts` | Forecast parsing, categories, geometry, validity, and formatting. |
| `client.test.ts` | HTTP behavior and metadata handling. |
| `scheduler.test.ts` | Request coordination, cache behavior, timing, retries, and races. |
| `storage.test.ts` | Migration and repository behavior using database test doubles. |
| `location.test.ts` | Permission, timeout, and cancellation behavior with simulated location APIs. |
| `interactions.test.tsx` | Rendered components and user interactions with isolated dependencies. |
| `setup.ts` | Shared test-environment setup. |

Run `npm run check` for TypeScript, lint, and automated tests. Tests do not establish that a native build works on every phone; actual device observations and gaps are recorded separately in [VALIDATION.md](VALIDATION.md).

## Configuration and supporting tools

| Root file | Purpose |
|---|---|
| `app.json` | App name, icon, platform identifiers, permissions, and Expo configuration plugins. |
| `package.json` | Required libraries and named commands such as `npm run ios` and `npm run check`. |
| `package-lock.json` | Exact installed dependency resolution, used by `npm ci`. Update through npm. |
| `.nvmrc` | Node.js version expected for local development. |
| `.gitignore` | Files and directories excluded from normal Git tracking. |
| `tsconfig.json` | TypeScript checks and source import aliases, including `@/` for `src/`. |
| `babel.config.js` | Code transformation settings, including the project's legacy Hermes compatibility setting. |
| `eslint.config.js` | Static checks for code quality and React conventions. |
| `jest.config.js` | Test discovery and the Expo/Jest test environment. |

Hermes is the JavaScript engine running the app's JavaScript on the device. Compatibility choices for it and other native dependencies are explained in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md).

| Supporting file | Purpose |
|---|---|
| `plugins/with-scene-lifecycle.js` | Apply the SDK 56/Xcode 27 scene-lifecycle customization when Expo generates the native project. |
| `scripts/patch-maplibre.mjs` | Apply the pinned MapLibre prefetch change during installation. |
| `scripts/feed-config.mjs` | Share NOAA query configuration between development scripts. |
| `scripts/check-outlook-feeds.mjs` | Inspect live feed schemas. |
| `scripts/capture-outlook-fixtures.mjs` | Intentionally replace historical fixtures with fresh captures. |
| `scripts/tile-diagnostics.mjs` | Serve synthetic local tiles to check native request headers and caching. |

These scripts are development/build tools. They are not screens or a production backend. The compatibility plugin and patch preserve native changes in trackable source so they can be reapplied during setup.

The remaining documentation is organized as follows:

- [README.md](../README.md): setup, running, data sources, and test commands.
- [PRODUCT_DESIGN.md](../PRODUCT_DESIGN.md): intended product behavior and design.
- [IMPLEMENTATION_V0_1.md](../IMPLEMENTATION_V0_1.md): implementation contracts and acceptance requirements.
- [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md): architecture, dependency choices, and workarounds.
- [VALIDATION.md](VALIDATION.md): actual checks, evidence, known issues, and unverified scenarios.
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md): this introduction to the source layout.

## Following one interaction through the code

When you tap a point on the map:

1. `OutlookMap.native.tsx` receives the map coordinate.
2. `PlacesProvider.tsx` updates the shared selection.
3. `ForecastSummary.tsx` reads that selection and the shared forecast snapshot.
4. `validity.ts` determines whether that snapshot can support an assessment; `pointRisk.ts` checks its polygons.
5. `RiskBadge.tsx` presents the category as text and color when appropriate.

That tap does not require a new NOAA request. The request scheduler manages national forecast downloads independently.

## Where to start reading or making changes

| If you want to… | Start with… |
|---|---|
| Understand the main interface | `src/app/(tabs)/index.tsx`, then `src/components/ForecastSummary.tsx` |
| Change shared colors or text styling | `src/theme/tokens.ts` |
| Change buttons consistently | `src/components/AppButton.tsx` |
| Understand saved-place behavior | `src/app/(tabs)/places.tsx`, then `src/features/places/` |
| Understand where forecast data comes from | `src/features/outlooks/sourceConfig.ts`, then `client.ts` and `normalize.ts` |
| Understand refresh and caching | `src/features/outlooks/scheduler.ts` and `src/storage/database.ts` |
| Change the app icon | `assets/icon.png` and its reference in `app.json` |
| Understand platform workarounds | `docs/IMPLEMENTATION_NOTES.md`, then `plugins/` and `scripts/patch-maplibre.mjs` |

For a first walkthrough, follow the Map screen into ForecastSummary and RiskBadge. That shows how a screen combines small components with shared data before you need to understand the network scheduler or native configuration.
