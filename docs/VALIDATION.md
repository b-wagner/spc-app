# Validation report

Tested September 24–25, 2026 against the uncommitted implementation working tree. No commit or publication was made. Native testing used an iPhone 18 Pro simulator, iOS 27.0, Xcode 27.0 (27A266a), macOS, Node 22.23.3, npm 10.9.9, CocoaPods 1.17.0 and Ruby 3.4.5.

## Automated checks

- `npm ci`: passed, including the idempotent/version-checked MapLibre native prefetch patch.
- `npm run check`: passed after the clean install: TypeScript, Expo lint, **6 suites / 66 tests**.
- `npx expo-doctor`: **22/22 passed**.
- `npx expo export --platform ios --platform android`: passed; generated both native Hermes bundles. This is JS/bundle validation, not an Android native build.
- iOS native source build: **Build Succeeded**, exit 0; installed and launched. Expo's log formatter reported two intermediate “command failed exit code 0” diagnostics plus a dev-launcher script dependency warning; these were not failed xcodebuild exits. The final runtime was separately inspected after correcting the Hermes Babel profile.

Tests cover strict timestamp parsing, malformed whole-snapshot rejection, category mapping, highest risk overlap, holes/MultiPolygons/boundaries, validity and expiry, timezone/DST formatting, empty results, older-product protection, single request concurrency/deduplication, priority, refresh deadlines, 304 recovery, Retry-After/backoff, cancellation/clear races, no-store, transport errors/timeouts, migrations/corrupt cache/retention, storage write failures/place limit, denied or late location results, and key rendered interactions. Native SQLite is mocked in unit tests; the real restart check below supplies separate persistence evidence.

`npm audit` reported **14 moderate, 0 high, 0 critical** findings through two transitive advisory families (`decode-uri-component` and `uuid`). npm suggested incompatible Expo/Router downgrades; no blind audit fix was applied. Review these with the next supported SDK upgrade: [decode-uri-component advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Doctor success does not mean an audit is clean.

## Observed native/manual results

| Check | Actual observation |
|---|---|
| Live launch | NOAA national polygons and OSM raster tiles rendered, with attribution and validity/check times. Final run used legacy Hermes with matching Babel profile and no fixture environment. |
| Day switching | Day 1/2 switched live with selected coordinates retained; Day 3 also inspected with historical fixture data and matching Day 3 dates/details. No old-day overlay flash noticed; no instrumented frame measurement. |
| Point lookup | Texas test coordinate 35.9110, -100.3352 displayed marginal Day 1 and general thunderstorms Day 2 in the earlier live run. Final Sep 25 live Day 1 displayed general thunderstorms/upcoming validity. These are timestamped observations, not a current forecast assertion. |
| Real SQLite persistence | Created “Test place,” renamed “Test renamed,” terminated/relaunched the process, and observed saved name, coordinates and forecast cache retained. Places showed Day 1 risk text. The disposable test place was then deleted through its confirmation UI and Places became empty. |
| Location denied | Denied native permission; readable “Location access is off. You can still tap the map.” and Open settings appeared. Existing selection/forecast and Places remained usable. |
| Location granted | Reset simulator permission, set a synthetic Texas coordinate, chose Allow Once, and observed the same coordinate selected with a forecast. No real user location was used. Cleared the simulator location override afterward. Timeout/cancellation are covered automatically. |
| Permissions | Generated iOS Info.plist has When In Use location only, no always-location or background modes. Android manifest explicitly removes background-location/foreground-location-service permissions. Android manifest is source inspection, not runtime evidence. |
| Large text | Set simulator content size to `accessibility-extra-extra-large`, relaunched, and scrolled Map to forecast validity/source/Details successfully. Fixed clipping in fixed-height navigation headers. Restored `large` afterward. This is one simulator size, not a full small-phone/200% matrix. |
| Details | Inspected Day 3 issued, valid-from/until, checked and downloaded times in local time and GMT, cache status and source link. |
| Tile identification | Native iOS raster requests carried `SPCOutlookPrototype/0.1.0` to a loopback synthetic endpoint using the production loader/header transform. |
| Tile caching | Three initial 200 responses; when expired, three If-None-Match requests received 304. A subsequent successful process restart made no additional tile requests while fresh. Native cache inspection confirmed stored expiry. See evidence/ios-tile-requests.jsonl and implementation notes. |
| Demo separation | Fixture mode visibly marked NOT CURRENT WEATHER; all secondary screens now include the warning. Returned to live mode at handoff. |
| Accessibility metadata | Native accessibility tree exposed text labels, selected days, disabled refresh, forecast text and named saved-place edit/delete controls. This is not a VoiceOver user test. |

Evidence files:

- `evidence/day2-selected.png`: earlier live Day 2 point selection.
- `evidence/live-day1-location.png`: final live iOS map after synthetic one-shot location.
- `evidence/large-text-summary.png`: enlarged text scrolled to source/validity/Details.
- `evidence/ios-tile-requests.jsonl`: synthetic native tile headers, freshness and conditional responses.

Screenshots demonstrate rendered states, not meteorological correctness.

## Remaining gaps and reproducible limitations

- **Android native build/run:** no Java/JDK, Android SDK, adb, Android Studio or emulator installed. Provision the README toolchain, run `npm run android`, then repeat location, map, persistence, header/cache and accessibility checks. JS export passed; native compatibility and Android tile policy behavior remain unverified.
- **Physical device:** none available. Signing, memory/gesture performance, battery behavior and real-device location have not been measured.
- **Screen readers/small screens:** complete VoiceOver/TalkBack navigation and a smaller phone remain unverified. Changing iOS accessibility text size while the app was already running initially left stale text measurements until relaunch; changing size, force-closing and reopening produced readable scrolling content. Test this SDK/runtime behavior on hardware before release.
- **Network end-to-end scenarios:** airplane-mode first launch/after caching, live provider outage and background/foreground stress have not been exhaustively exercised natively. Automated adapter/scheduler tests cover error, invalid JSON, timeout, retry deadlines, empty/expired data and cache retention; they are not claimed as native network-isolation tests.
- **Official visual comparison:** source schema/times were inspected and domain lookup tested, but a same-issuance side-by-side comparison against all three official SPC graphic products remains unverified.
- **Performance:** no obvious blocking during observed map/point/day actions, but the plan's 250 ms day-switch / one-second cached-text goals were not instrumented. Source compilation and Metro development startup are not representative of release startup.

This is a locally runnable prototype, not a published or fully device-qualified release. No emergency-warning capability is present.
