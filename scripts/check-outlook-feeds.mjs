import { service, layers, url, get } from "./feed-config.mjs";
for (const day of [1, 2, 3]) {
  const { data: schema } = await get(`${service}/${layers[day]}?f=pjson`);
  if (schema.name !== `Day ${day} Categorical Outlook`)
    throw Error(`Unexpected layer ${schema.name}`);
  for (const field of ["dn", "label", "issue", "valid", "expire"])
    if (!schema.fields.some((f) => f.name.toLowerCase() === field))
      throw Error(`Missing ${field}`);
  const { data, bytes } = await get(url(day));
  if (
    data.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    bytes > 10 * 1024 * 1024
  )
    throw Error("Invalid collection");
  console.log(
    JSON.stringify(
      {
        day,
        layer: schema.name,
        maxRecordCount: schema.maxRecordCount,
        features: data.features.length,
        bytes,
        fields: schema.fields.map((f) => ({ name: f.name, type: f.type })),
        times: data.features[0]?.properties,
      },
      null,
      2,
    ),
  );
}
