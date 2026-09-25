export const service =
  "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer";
export const layers = { 1: 1, 2: 9, 3: 17 };
export function url(day) {
  return `${service}/${layers[day]}/query?${new URLSearchParams({ where: "1=1", outFields: "objectid,dn,label,label2,issue,valid,expire,idp_source,idp_filedate,idp_ingestdate,fill,stroke", returnGeometry: "true", outSR: "4326", f: "geojson" })}`;
}
export async function get(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "SPCOutlookPrototype/0.1.0",
      Accept: "application/geo+json, application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const text = await r.text();
  const data = JSON.parse(text);
  if (data.error || data.exceededTransferLimit)
    throw Error("Invalid/incomplete service response");
  return { data, bytes: Buffer.byteLength(text) };
}
