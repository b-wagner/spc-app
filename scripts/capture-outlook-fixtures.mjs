import { mkdir, writeFile } from "node:fs/promises";
import { url, get } from "./feed-config.mjs";
await mkdir("test/fixtures", { recursive: true });
const manifest = {
  description: "Historical NOAA samples. Never current weather.",
  fixtureReferenceTime: "2026-09-24T18:00:00.000Z",
  captures: [],
};
for (const day of [1, 2, 3]) {
  const sourceUrl = url(day),
    { data, bytes } = await get(sourceUrl);
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
    throw Error("Invalid collection");
  await writeFile(`test/fixtures/day${day}.json`, JSON.stringify(data));
  manifest.captures.push({
    day,
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    bytes,
    featureCount: data.features.length,
    times: data.features.map((f) => ({
      issue: f.properties.issue,
      valid: f.properties.valid,
      expire: f.properties.expire,
    })),
  });
}
await writeFile(
  "test/fixtures/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Captured three historical layers.");
