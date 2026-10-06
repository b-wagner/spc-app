#!/usr/bin/env node
/** Build or verify the read-only Census Places/ZCTA search asset (Node 22+). */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import normalizer from "../src/features/search/normalization.js";

const DATA_VERSION = "2025";
const SCHEMA_VERSION = "1";
const MAX_BYTES = 20 * 1024 * 1024;
const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT = resolve(ROOT, `assets/search/us-locations-${DATA_VERSION}.sqlite`);
const DEFAULT_MANIFEST = resolve(ROOT, "assets/search/manifest.json");
const SOURCES = {
  places: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip",
  zctas: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip",
};
const EXPECTED_SHA256 = {
  places: "49644173a453469d9bd77fb7a493b027f87567e209edaf2078aac7543ac2ee29",
  zctas: "51516a4283bab5cd2376eec75609ddc4b363a18297e8adeeaac7b03cf7c84dbe",
};
const STATES = [
  ["01", "AL", "Alabama"], ["04", "AZ", "Arizona"], ["05", "AR", "Arkansas"],
  ["06", "CA", "California"], ["08", "CO", "Colorado"], ["09", "CT", "Connecticut"],
  ["10", "DE", "Delaware"], ["11", "DC", "District of Columbia"], ["12", "FL", "Florida"],
  ["13", "GA", "Georgia"], ["16", "ID", "Idaho"], ["17", "IL", "Illinois"],
  ["18", "IN", "Indiana"], ["19", "IA", "Iowa"], ["20", "KS", "Kansas"],
  ["21", "KY", "Kentucky"], ["22", "LA", "Louisiana"], ["23", "ME", "Maine"],
  ["24", "MD", "Maryland"], ["25", "MA", "Massachusetts"], ["26", "MI", "Michigan"],
  ["27", "MN", "Minnesota"], ["28", "MS", "Mississippi"], ["29", "MO", "Missouri"],
  ["30", "MT", "Montana"], ["31", "NE", "Nebraska"], ["32", "NV", "Nevada"],
  ["33", "NH", "New Hampshire"], ["34", "NJ", "New Jersey"], ["35", "NM", "New Mexico"],
  ["36", "NY", "New York"], ["37", "NC", "North Carolina"], ["38", "ND", "North Dakota"],
  ["39", "OH", "Ohio"], ["40", "OK", "Oklahoma"], ["41", "OR", "Oregon"],
  ["42", "PA", "Pennsylvania"], ["44", "RI", "Rhode Island"], ["45", "SC", "South Carolina"],
  ["46", "SD", "South Dakota"], ["47", "TN", "Tennessee"], ["48", "TX", "Texas"],
  ["49", "UT", "Utah"], ["50", "VT", "Vermont"], ["51", "VA", "Virginia"],
  ["53", "WA", "Washington"], ["54", "WV", "West Virginia"], ["55", "WI", "Wisconsin"],
  ["56", "WY", "Wyoming"],
];
const STATE_BY_FIPS = new Map(STATES.map(([fips, abbreviation, name]) => [fips, { abbreviation, name }]));

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: node scripts/build-location-database.mjs --download | --places FILE --zctas FILE [--output FILE] [--verify]");
  process.exitCode = 1;
}

function args() {
  const value = { download: false, verify: false, output: DEFAULT_OUTPUT };
  for (let i = 2; i < process.argv.length; i++) {
    const argument = process.argv[i];
    if (argument === "--download" || argument === "--verify") value[argument.slice(2)] = true;
    else if (["--places", "--zctas", "--output"].includes(argument)) value[argument.slice(2)] = resolve(process.argv[++i] ?? "");
    else return null;
  }
  return value;
}

const hash = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const inBounds = (longitude, latitude) => longitude >= -125 && longitude <= -66 && latitude >= 24 && latitude <= 50;
const { normalizeSearchText: normalize, normalizePlaceName: normalizePlace } = normalizer;

async function download(kind) {
  const target = resolve("/private/tmp", basename(SOURCES[kind]));
  const response = await fetch(SOURCES[kind]);
  if (!response.ok) throw Error(`Could not download ${SOURCES[kind]} (${response.status})`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

function rowsFromZip(path, expectedHeader) {
  let text;
  try {
    text = execFileSync("unzip", ["-p", path], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    throw Error(`Could not read ZIP archive: ${path}`);
  }
  const [header, ...lines] = text.trimEnd().split(/\r?\n/);
  const columns = header.split("|");
  for (const required of expectedHeader) if (!columns.includes(required)) throw Error(`${path} is missing required column ${required}`);
  return lines.map((line, index) => {
    const fields = line.split("|");
    if (fields.length !== columns.length) throw Error(`${path} has malformed row ${index + 2}`);
    return Object.fromEntries(columns.map((column, columnIndex) => [column, fields[columnIndex]]));
  });
}

function finiteCoordinate(row, source, line) {
  const latitude = Number(row.INTPTLAT), longitude = Number(row.INTPTLONG);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw Error(`${source} has invalid coordinates at row ${line}`);
  return { latitude, longitude };
}

async function verify(output, manifestPath) {
  const [database, manifestText] = await Promise.all([stat(output), readFile(manifestPath, "utf8")]);
  const manifest = JSON.parse(manifestText);
  const outputHash = await hash(output);
  if (database.size > MAX_BYTES || manifest.output?.sha256 !== outputHash || manifest.output?.bytes !== database.size)
    throw Error("Committed search database does not match its manifest");
  const db = new DatabaseSync(output, { readOnly: true });
  try {
    const metadata = new Map(db.prepare("SELECT key, value FROM search_metadata").all().map((row) => [row.key, row.value]));
    if (metadata.get("schema_version") !== SCHEMA_VERSION || metadata.get("data_version") !== DATA_VERSION)
      throw Error("Committed search database has unexpected metadata");
    if (metadata.get("places_sha256") !== manifest.sources?.places?.sha256 || metadata.get("zctas_sha256") !== manifest.sources?.zctas?.sha256)
      throw Error("Committed search database source metadata does not match its manifest");
    for (const table of ["states", "census_places", "zctas"]) if (!db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count) throw Error(`Committed search database has no ${table}`);
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw Error("Committed search database failed integrity check");
    for (const table of ["census_places", "zctas"]) {
      const outOfBounds = db.prepare(`SELECT count(*) AS count FROM ${table} WHERE longitude < -125 OR longitude > -66 OR latitude < 24 OR latitude > 50`).get().count;
      if (outOfBounds) throw Error(`Committed search database has out-of-bounds ${table}`);
    }
  } finally { db.close(); }
  console.log(`Verified ${outputHash} (${database.size} bytes)`);
}

async function build(options) {
  const placesPath = options.download ? await download("places") : options.places;
  const zctasPath = options.download ? await download("zctas") : options.zctas;
  if (!placesPath || !zctasPath) return usage("Provide both --places and --zctas, or use --download.");
  const sourceHashes = { places: await hash(placesPath), zctas: await hash(zctasPath) };
  for (const kind of ["places", "zctas"]) if (sourceHashes[kind] !== EXPECTED_SHA256[kind]) throw Error(`${kind} archive checksum did not match pinned 2025 source`);
  const places = rowsFromZip(placesPath, ["USPS", "GEOID", "NAME", "INTPTLAT", "INTPTLONG"]);
  const zctas = rowsFromZip(zctasPath, ["GEOID", "INTPTLAT", "INTPTLONG"]);
  await mkdir(dirname(options.output), { recursive: true });
  const temporary = `${options.output}.tmp`;
  await unlink(temporary).catch(() => undefined);
  const db = new DatabaseSync(temporary);
  const counts = { placeInput: places.length, placeExcluded: 0, zctaInput: zctas.length, zctaExcluded: 0, places: 0, zctas: 0 };
  try {
    db.exec(`
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      CREATE TABLE search_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE states (fips TEXT PRIMARY KEY, abbreviation TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE, normalized_name TEXT NOT NULL UNIQUE);
      CREATE TABLE census_places (geoid TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL, state_abbreviation TEXT NOT NULL REFERENCES states(abbreviation), longitude REAL NOT NULL, latitude REAL NOT NULL);
      CREATE TABLE zctas (zip TEXT PRIMARY KEY CHECK(length(zip) = 5), longitude REAL NOT NULL, latitude REAL NOT NULL);
      CREATE INDEX census_places_name_state ON census_places(normalized_name, state_abbreviation);
      CREATE INDEX census_places_name ON census_places(normalized_name);
    `);
    const insertState = db.prepare("INSERT INTO states VALUES (?, ?, ?, ?)");
    for (const [fips, abbreviation, name] of STATES) insertState.run(fips, abbreviation, name, normalize(name));
    const insertPlace = db.prepare("INSERT OR IGNORE INTO census_places VALUES (?, ?, ?, ?, ?, ?)");
    for (let index = 0; index < places.length; index++) {
      const row = places[index], state = STATE_BY_FIPS.get(row.GEOID.slice(0, 2)), { latitude, longitude } = finiteCoordinate(row, "Places", index + 2);
      if (!state || !inBounds(longitude, latitude)) { counts.placeExcluded++; continue; }
      const normalized = normalizePlace(row.NAME);
      if (!normalized) throw Error(`Places has blank normalized name at row ${index + 2}`);
      const result = insertPlace.run(row.GEOID, row.NAME, normalized, state.abbreviation, longitude, latitude);
      counts.places += result.changes;
    }
    const insertZcta = db.prepare("INSERT OR IGNORE INTO zctas VALUES (?, ?, ?)");
    for (let index = 0; index < zctas.length; index++) {
      const row = zctas[index], { latitude, longitude } = finiteCoordinate(row, "ZCTAs", index + 2);
      if (!/^\d{5}$/.test(row.GEOID)) throw Error(`ZCTAs has invalid ZIP at row ${index + 2}`);
      if (!inBounds(longitude, latitude)) { counts.zctaExcluded++; continue; }
      counts.zctas += insertZcta.run(row.GEOID, longitude, latitude).changes;
    }
    if (!counts.places || !counts.zctas) throw Error("No searchable places or ZCTAs were generated");
    const metadata = db.prepare("INSERT INTO search_metadata VALUES (?, ?)");
    const generatedAt = new Date().toISOString();
    for (const [key, value] of Object.entries({ schema_version: SCHEMA_VERSION, data_version: DATA_VERSION, census_vintage: DATA_VERSION, generated_at: generatedAt, places_url: SOURCES.places, zctas_url: SOURCES.zctas, places_sha256: sourceHashes.places, zctas_sha256: sourceHashes.zctas, ...Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, String(value)])) })) metadata.run(key, value);
    db.exec("VACUUM;");
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw Error("Generated database failed integrity check");
  } finally { db.close(); }
  const size = (await stat(temporary)).size;
  if (size > MAX_BYTES) throw Error(`Generated database is ${size} bytes, over the ${MAX_BYTES}-byte ceiling`);
  await rename(temporary, options.output);
  const outputHash = await hash(options.output);
  const manifest = {
    schemaVersion: 1, dataVersion: DATA_VERSION, censusVintage: DATA_VERSION, retrievedAt: new Date().toISOString(),
    sources: Object.fromEntries(Object.entries(SOURCES).map(([key, url]) => [key, { url, sha256: sourceHashes[key] }])),
    output: { file: basename(options.output), sha256: outputHash, bytes: size, rows: { places: counts.places, zctas: counts.zctas } },
    note: "ZCTAs are Census statistical areas, not a complete or authoritative USPS ZIP-code directory. ZIPs without a ZCTA intentionally have no result.",
  };
  await writeFile(DEFAULT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ...counts, bytes: size, sha256: outputHash }, null, 2));
}

const options = args();
if (!options) usage();
else if (options.verify) verify(options.output, DEFAULT_MANIFEST).catch((error) => { console.error(error.message); process.exitCode = 1; });
else build(options).catch((error) => { console.error(error.message); process.exitCode = 1; });
