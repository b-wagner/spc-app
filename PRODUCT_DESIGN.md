# SPC Outlook — Product and Design

Version: 0.1 design baseline  
Date: September 24, 2026  
Status: Proposed product; implementation has not started  
Companion: [Detailed v0.1 implementation plan](./IMPLEMENTATION_V0_1.md)

## 1. Product definition

**SPC Outlook** is the working name for an independent mobile app that makes the Storm Prediction Center's severe-weather outlooks easy to browse on a phone. It presents official forecast boundaries on an interactive map, explains the categorical risk at a selected location, and remembers places the user cares about.

The product is intended to be free to use, without advertising, subscriptions, or in-app purchases initially. It obtains weather data directly from public NOAA services and caches it on the device. The initial architecture has no developer-operated backend, account system, or paid weather-data provider.

The app's value is the mobile experience: useful defaults, readable information, simple navigation, and honest communication of data age. It does not create forecasts.

The central question is:

> What does the SPC outlook show for this area over the next few days, and when does that outlook apply?

## 2. Intended audience

- People who already check SPC outlooks and want an easier mobile interface.
- People who want to check the outlook around home, family, travel destinations, or outdoor activities.
- Weather enthusiasts who want a quick overview without opening a complex forecasting workstation.

The first iteration prioritizes national and regional situational awareness within the contiguous United States. It does not promise global weather coverage or address-level forecast precision.

## 3. What the app does

The product direction is a focused viewer for selected SPC products. The first implementation delivers a complete, small subset: **Day 1, Day 2, and Day 3 categorical convective outlooks**.

A user can:

1. Open the app and see a national outlook map.
2. Switch between Day 1, Day 2, and Day 3.
3. Pan and zoom the map.
4. Tap a point to inspect its highest applicable categorical risk.
5. Optionally center the map on the device's current location.
6. Save and name selected coordinates, then revisit them later.
7. Read a categorical legend and the forecast's issue and valid times.
8. Refresh the outlook and see whether the last update succeeded.
9. Reopen the app with the most recently cached outlooks and saved places.
10. Open the corresponding official SPC outlook page in the system browser.

Location permission is optional. Manual map selection provides the complete browsing experience without it.

## 4. What the app is not

- An official NOAA, NWS, or SPC application.
- A source of independently generated forecasts or AI-generated weather advice.
- An emergency warning or guaranteed notification service.
- A radar viewer, storm tracker, navigation tool, or storm-chasing workstation.
- A complete replacement for the SPC website.
- A general weather app with temperatures, precipitation forecasts, and hourly conditions.
- A guarantee that severe weather cannot occur outside a highlighted area.
- A precise forecast of whether a particular building will experience severe weather.
- An account-based service that collects or synchronizes personal locations.
- A fully offline map application: weather data can be cached, but unvisited basemap areas may require connectivity.

Use the app's own name and visual identity. Credit the forecast source without using government branding to imply endorsement.

## 5. Scope decisions

| Capability | v0.1 | Later consideration |
|---|---|---|
| Day 1–3 categorical outlooks | Required | — |
| Interactive map and point inspection | Required | — |
| Saved coordinates and optional device location | Required | — |
| Weather caching and visible freshness | Required | — |
| Legend, source links, and accessible text | Required | — |
| Days 4–8 outlooks | Excluded | Natural next extension |
| Tornado, wind, and hail probability layers | Excluded | Add with day-specific product support |
| Conditional Intensity Groups | Excluded as separate layers | Add alongside probabilities with correct explanations |
| Watches and storm reports | Excluded | Evaluate after the outlook experience |
| Mesoscale discussion reader or advanced analysis | Excluded | Outside the initial product focus |
| Radar | Excluded | Outside the initial product focus |
| Notifications, widgets, background monitoring | Excluded | Separate product and reliability decision |
| Address or city autocomplete | Excluded | Evaluate a geocoding source separately |
| Accounts, sync, analytics, payments, ads | Excluded | No implementation placeholders needed |
| Publishing, store submission, deployment automation | Excluded | Outside these documents |

This is an intentional iteration boundary, not a claim that the other data is unavailable. Categorical outlooks can be displayed without implementing the separate probability or conditional-intensity products. Do not add an outdated “significant severe” hatching interpretation to v0.1.

## 6. Primary user journeys

### 6.1 First launch

The app opens directly to the Map screen. It requests Day 1 data and loads the background map independently. No signup, onboarding carousel, or automatic permission prompt appears. Once Day 1 has been attempted, it fetches Days 2 and 3 sequentially for fast switching.

The default camera shows the contiguous US. A compact message invites the user to tap the map or use Locate me. The day selector says “Day 1,” “Day 2,” and “Day 3”; a date appears only after the corresponding valid period is known.

### 6.2 Inspect a place

A map tap places a visible pin. A bottom summary displays the selected coordinates or saved name and the categorical result for that exact point in the source geometry. Selecting another day retains the point and recalculates the result from that day's data.

The app never labels a location “safe.” Outside all displayed polygons, it says “Not inside a displayed outlook area,” with an explanation of geographic scope and uncertainty.

### 6.3 Save and return

The user selects a point, taps Save place, enters a name, and saves. The Places screen lists saved locations and their Day 1 results when usable cached data exists. Selecting a place returns to the map and inspects that location.

Saved places remain on the device. v0.1 supports at most 20 to keep the interface and interactions simple.

### 6.4 Use device location

The Locate me action requests foreground permission when needed, obtains a single location fix, and inspects it. It does not start background tracking. Denial or unavailable GPS leaves manual selection fully usable.

### 6.5 Reopen with poor connectivity

Previously cached weather data appears with its original timestamps. The app attempts an update when appropriate. An update failure is visible and does not erase an otherwise usable cached result. Expired data is visibly labeled and never reported as a current risk assessment.

Cached map tiles may appear, but the app does not promise an entire map is available offline. A missing basemap does not prevent reading the selected location's weather information.

## 7. Information architecture

Use two primary tabs: **Map** and **Places**. An information button on Map opens **About & data** as a modal screen. Supporting modals provide the full legend, forecast details, and place editing.

### Map screen

```text
┌─────────────────────────────────────┐
│ SPC Outlook                   Info  │
│ Day 1       Day 2       Day 3        │
│ [date]      [date]      [date]       │
│ Checked 2 min ago          Refresh  │
├─────────────────────────────────────┤
│                                     │
│           OUTLOOK MAP               │
│                                     │
│                           Locate me │
│                           US view   │
│                           Legend    │
│ © OpenStreetMap contributors        │
├─────────────────────────────────────┤
│ Home                     Save/Edit  │
│ Slight risk · Level 2 of 5           │
│ Valid [local start] – [local end]    │
│ Details                             │
├─────────────────────────────────────┤
│        Map             Places       │
└─────────────────────────────────────┘
```

The wireframe is structural. Text wraps and controls rearrange at larger accessibility text sizes. The summary panel occupies layout space below the map rather than covering the selected point or attribution. Details open in a scrollable modal; v0.1 does not require a draggable sheet.

### Places screen

Each row includes the user-provided name, coordinates, and a text result for Day 1. A timestamp or expired/unavailable indicator accompanies that result. Provide explicit Edit and Delete actions. The empty state explains how to add a point from the map and includes a Go to map button.

### About & data

Include product purpose, forecast source, basemap attribution, geographic scope, caching behavior, privacy explanation, version, and links to official information. Include a Clear cached forecasts action that preserves saved places. This is a data-management action, not a request to clear or bypass the map provider's tile cache.

## 8. Visual direction

The interface should feel calm, legible, and functional. Weather colors should carry meaning; the surrounding UI should be neutral.

- Light theme only for v0.1; dark theme is a later design task.
- System fonts, with approximately 16-point body text and 20–24-point primary titles.
- Slate text, white cards, a pale gray application background, and a blue interaction accent.
- Use familiar SPC categorical color families and always pair them with text.
- Use distinct outlines around outlook areas and a high-contrast marker for the selected point.
- Retain a full legend regardless of which categories occur in the current forecast.
- Use standard OSM raster tiles initially. They provide labels but cannot independently restyle roads or city names. A future vector basemap can provide a quieter background.
- Prefer ordinary controls and modest transitions. Avoid decorative weather animation, dramatic gradients, glass effects, and persistent map motion.

Category presentation:

| Source category | App label | Severity notation |
|---|---|---|
| TSTM | General thunderstorms | Separate from the five severe-risk levels |
| MRGL | Marginal risk | Level 1 of 5 |
| SLGT | Slight risk | Level 2 of 5 |
| ENH | Enhanced risk | Level 3 of 5 |
| MDT | Moderate risk | Level 4 of 5 |
| HIGH | High risk | Level 5 of 5 |

Never show the source's numeric GIS code as the user-facing risk level. A source code of 8, for example, denotes High, not “8 out of 5.”

## 9. Trust and data presentation

Keep three timestamps distinct:

1. **Issued:** when SPC issued the outlook.
2. **Valid:** the period to which the outlook applies.
3. **Checked:** when the app last successfully retrieved or revalidated the feed.

“Checked just now” does not establish that the upstream forecast itself is new. Explain that the data service can lag issuance. Display local times with a timezone abbreviation, and include UTC in Details. Day numbers follow the SPC product; they are not translated blindly into local “today” and “tomorrow.”

An empty response, failed request, expired outlook, and selected point outside polygons are different states. The implementation must preserve that distinction. This is more important than making every screen look populated.

## 10. Proposed technical stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile framework | React Native with Expo | Shared application code for iOS and Android and straightforward native development tooling |
| Language | TypeScript, strict mode | Explicit contracts between feeds, domain logic, storage, and UI |
| Navigation | Expo Router | Map/Places tabs and ordinary modal screens |
| Map renderer | `@maplibre/maplibre-react-native` | Native rendering of a basemap and GeoJSON overlays |
| Basemap | OSM standard raster tiles | No API key or separate map account for the compliant prototype |
| Forecast source | NOAA's SPC outlook ArcGIS REST service, GeoJSON query output | Machine-readable boundaries and attributes |
| Networking | React Native `fetch`, timeouts, conditional requests | Direct device-to-provider requests |
| Persistence | `expo-sqlite` | On-device forecasts, named places, and preferences |
| Location | `expo-location` | Optional foreground location lookup |
| Geometry | Turf point-in-polygon utility | Correct Polygon/MultiPolygon and hole handling |
| UI styling | React Native `StyleSheet` and shared tokens | Small dependency surface and predictable layout |
| Application state | React context and reducers | Sufficient for three outlook products and two main screens |
| Tests | Jest, Expo's preset, React Native Testing Library | Domain correctness and meaningful interaction tests |
| Builds | Local Expo development builds using Xcode/Android Studio | No cloud build subscription or hosted service dependency |

The implementation plan fixes a version family and a procedure for locking compatible patch versions. MapLibre uses a native module, so use a development build rather than Expo Go. The stack creates a standalone mobile application; it does not wrap the SPC website in a browser.

## 11. Data architecture and operating costs

```text
NOAA outlook service ── direct HTTPS ──► app forecast repository
                                              │
                                              ├── validation and normalization
                                              ├── SQLite on the device
                                              └── React state ──► map and text UI

OSM tile service ── direct HTTPS ──► MapLibre native tile cache/rendering
```

Weather caching and map caching are separate systems. The app owns the weather-cache rules. Map requests must comply with the map provider's policies.

The architecture requires no recurring developer-operated backend bill, paid weather subscription, geocoder, or cloud database. Public map service access is best-effort; it is not an unlimited service-level commitment. Keep provider configuration isolated so a future change does not require rebuilding the entire map feature. Public distribution and its administrative costs are outside v0.1.

NOAA/NWS material is generally public domain unless marked otherwise, with restrictions against misrepresenting ownership, alteration, or endorsement. Third-party maps have their own attribution and usage obligations. [NWS policy](https://www.weather.gov/disclaimer)

## 12. Privacy and accessibility

- No account, ads, analytics SDK, device tracking identifier, or background location collection.
- Store named places locally; do not include coordinates or names in NOAA requests.
- Explain that providers still receive ordinary network information. Map tile requests reveal the area being viewed.
- Request location only after the user chooses Locate me.
- Allow large text and screen-reader access to every action and all weather information.
- Ensure useful information remains available through text; the map must not be the only way to inspect a saved place.
- Use at least 48-by-48 logical-unit targets for primary icon buttons.
- Avoid “safe,” “all clear,” or other unsupported safety conclusions.

## 13. Definition of a successful v0.1

An evaluator can install a local development build, view live Day 1–3 categorical outlooks, inspect a location, save it, restart the app, and recover both the place and cached weather. Data failures, permission denial, invalid payloads, and expiry produce understandable UI instead of a crash or false reassurance.

Both iOS and Android are intended targets. A platform that has not been built and run must be reported as unverified, not counted as complete. The companion document defines the required evidence and tests.

## 14. Research basis

Official documentation and sample data were checked on September 24, 2026. Live GeoJSON queries to categorical layers 1, 9, and 17 succeeded during preparation of these documents. This confirms access and sample format, not continuous availability or library compatibility on a built device.

- [SPC outlook service and layer catalog](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer)
- [Day 1 categorical layer](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/1)
- [Day 2 categorical layer](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/9)
- [Day 3 categorical layer](https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer/17)
- [OSM raster tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [Expo SDK compatibility reference](https://docs.expo.dev/versions/latest/)
- [MapLibre setup](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- [MapLibre Expo integration](https://maplibre.org/maplibre-react-native/docs/setup/expo/)
- [Expo local development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [SPC conditional-intensity change notice](https://www.weather.gov/media/notification/pdf_2026/scn26-11_SPC_conditional-intensity.pdf)
