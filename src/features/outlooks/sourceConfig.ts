import type { OutlookDay } from "./types";
export const USER_AGENT = "SPCOutlookPrototype/0.1.0";
export const SERVICE_URL =
  "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer";
export const LAYERS = { 1: 1, 2: 9, 3: 17 } as const;
export const OUT_FIELDS =
  "objectid,dn,label,label2,issue,valid,expire,idp_source,idp_filedate,idp_ingestdate,fill,stroke";
/** Full national layer: no selected or saved coordinate is sent to NOAA. */
export function queryUrl(day: OutlookDay) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  return `${SERVICE_URL}/${LAYERS[day]}/query?${params}`;
}
/** Trusted destination, independent of arbitrary provider properties. */
export function spcUrl(day: OutlookDay) {
  return `https://www.spc.noaa.gov/products/outlook/day${day}otlk.html`;
}
