/**
 * The worker's work area: a central ZIP plus a radius, turned into the list of ZIP codes it
 * covers. The list can then be adjusted by hand. Positions come from the public US Census ZIP
 * table (one central point per ZIP, so the result is approximate). The table is a static file
 * that is downloaded only when the worker edits the area; the public page never needs it, it
 * only reads the finished list.
 */

export type ZipTable = Map<string, readonly [number, number]>;

export const RADIUS_OPTIONS = [3, 5, 10, 15, 25] as const;
/** Same limit as the database. */
export const MAX_ZIPS = 250;

export const isZip = (z: string) => /^\d{5}$/.test(z);

/** "91101,34.147,-118.139" per line. */
export function parseZipTable(text: string): ZipTable {
  const table: ZipTable = new Map();
  for (const line of text.split("\n")) {
    const [zip, lat, lon] = line.split(",");
    if (zip && lat && lon && isZip(zip)) table.set(zip, [Number(lat), Number(lon)]);
  }
  return table;
}

let cached: Promise<ZipTable> | null = null;

/** Downloads the ZIP table once per session. */
export function loadZipTable(): Promise<ZipTable> {
  cached ??= fetch("/data/zip-centroids.txt")
    .then((r) => {
      if (!r.ok) throw new Error("zip_table_unavailable");
      return r.text();
    })
    .then(parseZipTable)
    .catch((e) => {
      cached = null; // try again next time
      throw e;
    });
  return cached;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance in miles (haversine). */
export function milesBetween(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ZIP codes whose central point is within `radiusMi` of the center, nearest first. */
export function zipsWithin(
  table: ZipTable,
  centerZip: string,
  radiusMi: number,
  max = MAX_ZIPS,
): { zips: string[]; truncated: boolean } | null {
  const center = table.get(centerZip);
  if (!center) return null;
  const found: [string, number][] = [];
  for (const [zip, point] of table) {
    const d = milesBetween(center, point);
    if (d <= radiusMi) found.push([zip, d]);
  }
  found.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return { zips: found.slice(0, max).map(([z]) => z), truncated: found.length > max };
}

/** One line for the page and the flyer ("Within 10 miles of ZIP 91101"). */
export function areaSummary(centerZip: string, radiusMi: number, lang: "en" | "es" = "en"): string {
  if (!isZip(centerZip) || radiusMi <= 0) return "";
  return lang === "en"
    ? `Within ${radiusMi} miles of ZIP ${centerZip}`
    : `A ${radiusMi} millas del ZIP ${centerZip}`;
}

export type AreaPoint = [zip: string, lat: number, lon: number];
export type AreaGeo = { center?: [number, number]; points?: AreaPoint[] };

/** The ZIP codes of `zips` that exist in the table, with their position. */
export function pointsFor(table: ZipTable, zips: readonly string[]): AreaPoint[] {
  const out: AreaPoint[] = [];
  for (const z of zips) {
    const p = table.get(z);
    if (p) out.push([z, p[0], p[1]]);
  }
  return out;
}

/** What the page stores for the map; a safe, small object. */
export function buildAreaGeo(
  center: readonly [number, number] | undefined,
  points: readonly AreaPoint[] | undefined,
): AreaGeo {
  const geo: AreaGeo = {};
  if (center) geo.center = [center[0], center[1]];
  if (points?.length) geo.points = points.map(([z, a, b]) => [z, a, b]);
  return geo;
}

/** Reads map data from the server defensively: anything odd is dropped, never trusted. */
export function readAreaGeo(raw: unknown): {
  center: [number, number] | null;
  points: AreaPoint[];
} {
  const g = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const c = g["center"];
  const center =
    Array.isArray(c) && num(c[0]) && num(c[1]) ? ([c[0], c[1]] as [number, number]) : null;
  const points: AreaPoint[] = [];
  if (Array.isArray(g["points"])) {
    for (const p of g["points"].slice(0, MAX_ZIPS)) {
      if (Array.isArray(p) && typeof p[0] === "string" && isZip(p[0]) && num(p[1]) && num(p[2])) {
        points.push([p[0], p[1], p[2]]);
      }
    }
  }
  return { center, points };
}

export type Coverage = "yes" | "no" | "unknown";

/** Does the worker cover this ZIP? "unknown" until the client typed a full ZIP or if no area is set. */
export function covers(zips: readonly string[], zip: string): Coverage {
  if (!zips.length || !isZip(zip)) return "unknown";
  return zips.includes(zip) ? "yes" : "no";
}
