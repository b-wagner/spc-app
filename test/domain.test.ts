import {
  normalizeOutlook,
  validateCachedSnapshot,
} from "@/features/outlooks/normalize";
import { parseSpcUtc } from "@/features/outlooks/timestamps";
import { getPointCategory } from "@/features/outlooks/pointRisk";
import { assessPoint, temporalState } from "@/features/outlooks/validity";
import { acceptResponse } from "@/features/outlooks/repository";
import { formatTime } from "@/utils/format";
import { FIXTURE_TIME } from "@/utils/clock";
import {
  allCategories,
  collection,
  feature,
  square,
} from "./fixtures/synthetic";
import day1 from "./fixtures/day1.json";
import day2 from "./fixtures/day2.json";
import day3 from "./fixtures/day3.json";
const normalize = (raw: unknown) => normalizeOutlook(raw, 1, FIXTURE_TIME);
test.each([
  "202602300000",
  "202613010000",
  "202601012400",
  "202601010060",
  "20260924161",
  "2026-09-24T12:00:00",
  "202609241200Z",
])("rejects impossible/noncontract date %s", (value) =>
  expect(() => parseSpcUtc(value)).toThrow(),
);
test.each(["202402290000", "202612312359", "202701010000"])(
  "parses UTC across leap/year boundaries %s",
  (value) => expect(Number.isFinite(parseSpcUtc(value))).toBe(true),
);
test("compact NOAA time is UTC independent of device timezone", () =>
  expect(parseSpcUtc("202609241614")).toBe(Date.UTC(2026, 8, 24, 16, 14)));
test.each([day1, day2, day3])(
  "captured NOAA geometry validates and roundtrips durable cache",
  (raw) => {
    const s = normalize(raw);
    expect(s.geojson.features.length).toBeGreaterThan(0);
    expect(validateCachedSnapshot(JSON.parse(JSON.stringify(s)), 1)).toEqual(s);
  },
);
test("highest rank wins regardless of feature order", () => {
  for (const features of [
    allCategories.features,
    [...allCategories.features].reverse(),
  ])
    expect(
      getPointCategory(
        normalize({ type: "FeatureCollection", features }),
        [-99, 38],
      ),
    ).toBe("HIGH");
});
test("holes, separate multipolygon parts, boundaries and outside are distinct", () => {
  const hole = feature();
  hole.geometry.coordinates.push(square(-102, 35, -100, 37));
  const multi = {
    ...feature(6, "MDT"),
    geometry: {
      type: "MultiPolygon",
      coordinates: [[square(-90, 30, -85, 35)], [square(-80, 30, -75, 35)]],
    },
  };
  const s = normalize({ type: "FeatureCollection", features: [hole, multi] });
  expect(getPointCategory(s, [-101, 36])).toBeNull();
  expect(getPointCategory(s, [-104, 33])).toBe("SLGT");
  expect(getPointCategory(s, [-77, 32])).toBe("MDT");
  expect(getPointCategory(s, [-120, 20])).toBeNull();
});
test("general thunderstorms is distinct from unavailable and outside", () => {
  const s = normalize(collection(feature(2, "TSTM")));
  expect(assessPoint(s, [-99, 38], FIXTURE_TIME).label).toBe(
    "General thunderstorms",
  );
  expect(assessPoint(null, [-99, 38], FIXTURE_TIME).state).toBe("unavailable");
});
test("expiry exact endpoint gates point lookup; upcoming remains inspectable", () => {
  const s = normalize(allCategories);
  expect(temporalState(s, s.expiresAt!)).toBe("expired");
  expect(assessPoint(s, [-99, 38], s.expiresAt!).category).toBeNull();
  expect(assessPoint(s, [-99, 38], s.validFrom! - 1).category).toBe("HIGH");
});
test("empty response cannot assert an all-clear", () => {
  const s = normalize(collection());
  expect(s.kind).toBe("empty-unverified");
  expect(s.validFrom).toBeNull();
  expect(assessPoint(s, [-99, 38], FIXTURE_TIME).state).toBe("unavailable");
});
test.each([
  { error: { code: 500 } },
  { ...allCategories, exceededTransferLimit: true },
  collection({ ...feature(), geometry: null } as unknown as ReturnType<
    typeof feature
  >),
  collection(feature(99, "NEW")),
  collection(feature(8, "SLGT")),
  collection({
    ...feature(),
    properties: { ...feature().properties, issue: "bad" },
  }),
  collection(feature(), {
    ...feature(),
    properties: { ...feature().properties, issue: "202609241600" },
  }),
  collection({
    ...feature(),
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 2],
        ],
      ],
    },
  }),
])("rejects entire invalid snapshot", (raw) =>
  expect(() => normalize(raw)).toThrow(),
);
test("unknown altitude is stripped and property casing normalized", () => {
  const f = feature();
  const raw = {
    ...f,
    properties: Object.fromEntries(
      Object.entries(f.properties).map(([k, v]) => [k.toUpperCase(), v]),
    ),
    geometry: {
      type: "Polygon",
      coordinates: [square(-100, 30, -95, 35).map((p) => [...p, 500])],
    },
  };
  expect(
    normalize({ type: "FeatureCollection", features: [raw] }).geojson
      .features[0].geometry.coordinates[0][0],
  ).toEqual([-100, 30]);
});
test("older issuance cannot roll back cache; next valid period allowed", () => {
  const old = normalize(allCategories),
    raw = collection({
      ...feature(),
      properties: { ...feature().properties, issue: "202609241500" },
    });
  const meta = {
    etag: null,
    lastModified: null,
    httpFreshUntil: null,
    noStore: false,
  };
  expect(() =>
    acceptResponse({ kind: "body", raw, meta }, old, 1, FIXTURE_TIME),
  ).toThrow("OLDER_PRODUCT");
  raw.features[0].properties.valid = "202609251200";
  raw.features[0].properties.expire = "202609261200";
  expect(
    acceptResponse({ kind: "body", raw, meta }, old, 1, FIXTURE_TIME).validFrom,
  ).toBeGreaterThan(old.validFrom!);
});
test("format endpoints separately across DST", () => {
  expect(
    formatTime(Date.UTC(2026, 10, 1, 6, 30), false, "America/Chicago"),
  ).toContain("CDT");
  expect(
    formatTime(Date.UTC(2026, 10, 1, 7, 30), false, "America/Chicago"),
  ).toContain("CST");
  expect(
    formatTime(Date.UTC(2026, 8, 25, 1), false, "America/Chicago"),
  ).toContain("Sep 24");
});
