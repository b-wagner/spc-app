# App icon concepts

The repository contains a flattened 1024×1024 PNG (`assets/icon.png`) and no editable source, icon generator, or adaptive-icon foreground/background pair. Version 0.2 implements the recommended Outlook Bands concept as that master asset. The generation prompt and constraints are recorded below so a future editable-vector pass can reproduce the intent.

All concepts avoid the NOAA mark, SPC logotype, federal seals, official blue-and-white lockups, and the words NOAA or SPC. They should be tested at 20, 29, 40, 60, 76, 120, and 180 px before export. Master artwork should be a 1024×1024 vector with important shapes inside a centered 700×700 safe area, no transparency in the iOS export, and no hairlines, small text, photographic detail, or reliance on a platform corner mask.

## Concept A — Outlook bands (implemented and recommended)

A dark charcoal storm cloud in the upper-right overlaps three broad, nested contour bands sweeping from lower-left to upper-right. Restrained green, yellow, and orange bands communicate categorical forecast risk areas while the cloud makes severe weather legible without copying official branding. The implemented version intentionally has no location dot.

- Background: warm off-white `#F5F6F7`.
- Cloud: charcoal `#17202A`, approximately 310×210 px.
- Bands: green `#4F8A55`, yellow `#D6A800`, orange `#C85D24`; minimum 72 px band thickness and 18 px separation.
- Small-size behavior: retain the cloud silhouette and all three broad bands; omit small secondary details.

This is the recommendation because its silhouette remains distinct at notification/search sizes, it represents the app's actual categorical-map behavior, and it avoids the generic radar-sweep look used by many weather apps.

## Concept B — Shielded horizon

A simplified horizon line with one angular thunderhead above it and a shallow shield-like bowl below. Three short colored horizon segments indicate increasing outlook levels. The shield suggests preparedness without claiming emergency-warning functionality.

- Background: deep slate `#263746`.
- Weather/horizon mark: off-white `#F5F6F7`.
- Risk segments: green `#66A366`, amber `#D6A800`, red-orange `#B8462B`.
- Keep the shield open at the top so it does not resemble a government badge.
- Do not add lightning smaller than 90 px; at small sizes use cloud/horizon only.

## Concept C — Map pin / storm split

A single bold location-pin silhouette split diagonally: the upper half contains a compact cloud notch, while the lower half contains two nested contour arcs. The pin is unmistakably location-oriented and works well as a monochrome accessibility/notification glyph.

- Background: muted navy `#244B73`.
- Pin: off-white `#F5F6F7`, approximately 540 px tall.
- Contour arcs: green `#4F8A55` and amber `#D6A800`, minimum 44 px stroke.
- Cloud notch: negative space only; no facial or mascot styling.
- Monochrome fallback: solid pin with the cloud notch retained.

## Production handoff

The current generated RGB PNG is the Expo master referenced by `app.json`. A future production pass should recreate it as SVG or another editable vector master, preserve that source under `assets/source/`, and add Android adaptive-icon foreground/background assets after validating the design against Android masks. Validate regenerated native asset catalogs after `npx expo prebuild --clean` in a disposable checkout or worktree so user native changes are not destroyed.
