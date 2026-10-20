/**
 * "¿En qué ciudad trabajas?": checks the city against the US Census list of places (cities,
 * towns and census-designated places; `public/data/us-places.txt`, "Name|ST|area", ~32,000 rows,
 * built from the 2024 Census Gazetteer). It runs on the phone: no key, no cost, no request with
 * what the user types, and it works offline once loaded. It is fetched only when step 3 opens.
 */
import { US_STATES } from "./taxes";

export type Place = { name: string; st: string; area: number };

let cache: Promise<Place[]> | null = null;

export function loadPlaces(): Promise<Place[]> {
  cache ??= fetch("/data/us-places.txt")
    .then((r) => {
      if (!r.ok) throw new Error("places_unavailable");
      return r.text();
    })
    .then((t) =>
      t
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          const [name = "", st = "", area = "0"] = l.split("|");
          return { name, st, area: Number(area) || 0 };
        }),
    )
    .catch((e) => {
      cache = null; // try again next time (e.g. the phone was offline)
      throw e;
    });
  return cache;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\s+/g, " ")
    .trim();

const STATE_BY_NAME = new Map(US_STATES.map(([code, name]) => [norm(name), code]));
// English / Spanish spellings people actually type.
for (const [alias, code] of [
  ["california", "CA"],
  ["florida", "FL"],
  ["nueva york", "NY"],
  ["new york", "NY"],
  ["nuevo mexico", "NM"],
  ["new mexico", "NM"],
  ["nueva jersey", "NJ"],
  ["new jersey", "NJ"],
  ["hawai", "HI"],
  ["hawaii", "HI"],
  ["luisiana", "LA"],
  ["louisiana", "LA"],
  ["michigan", "MI"],
  ["misuri", "MO"],
  ["missouri", "MO"],
  ["pensilvania", "PA"],
  ["pennsylvania", "PA"],
  ["carolina del norte", "NC"],
  ["north carolina", "NC"],
  ["carolina del sur", "SC"],
  ["south carolina", "SC"],
  ["dakota del norte", "ND"],
  ["dakota del sur", "SD"],
  ["virginia occidental", "WV"],
  ["west virginia", "WV"],
  ["washington dc", "DC"],
  ["dc", "DC"],
] as const)
  STATE_BY_NAME.set(alias, code);
const STATE_CODES = new Set(US_STATES.map(([c]) => c.toLowerCase()));

function stateOf(text: string): string | null {
  const t = norm(text);
  if (STATE_CODES.has(t)) return t.toUpperCase();
  return STATE_BY_NAME.get(t) ?? null;
}

/** Full state name for display ("CA" → "California"). */
const TERRITORIES: Record<string, string> = {
  PR: "Puerto Rico",
  GU: "Guam",
  VI: "Islas Vírgenes",
  AS: "Samoa Americana",
  MP: "Islas Marianas del Norte",
};
export const stateName = (code: string) =>
  US_STATES.find(([c]) => c === code)?.[1] ?? TERRITORIES[code] ?? code;

/** "Los Angeles, CA": the value Marcelo stores as the user's city. */
export const placeValue = (p: Place) => `${p.name}, ${p.st}`;

/** Splits what was typed into the city text and, when present, the state. */
function parse(input: string): { q: string; st: string | null } {
  const raw = input.trim();
  const comma = raw.lastIndexOf(",");
  if (comma > 0) {
    // "Miami, Flo": still typing the state → no state filter yet, rank by the city.
    return { q: norm(raw.slice(0, comma)), st: stateOf(raw.slice(comma + 1)) };
  }
  // "Miami FL" / "Miami Florida" without a comma: peel a state off the end.
  const words = raw.split(/\s+/);
  for (const n of [3, 2, 1]) {
    if (words.length > n) {
      const st = stateOf(words.slice(-n).join(" "));
      if (st) return { q: norm(words.slice(0, -n).join(" ")), st };
    }
  }
  return { q: norm(raw), st: null };
}

/**
 * Up to `limit` places for what was typed: "miami", "Miami, FL", "Miami Florida", "san anto".
 * Best first: exact name, then names that start with the text, then bigger places.
 */
export function searchPlaces(places: Place[], input: string, limit = 4): Place[] {
  if (input.trim().length < 2) return [];
  const { q, st } = parse(input);
  if (!q) return [];
  const scored: { p: Place; s: number }[] = [];
  for (const p of places) {
    if (st && p.st !== st) continue;
    const n = norm(p.name);
    const s = n === q ? 3 : n.startsWith(q) ? 2 : 0;
    if (s) scored.push({ p, s });
  }
  scored.sort((a, b) => b.s - a.s || b.p.area - a.p.area || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((x) => x.p);
}

/**
 * The place the text clearly names: the exact city name plus a state ("Miami, FL"), or a city
 * name that exists in one state only. Null while it is ambiguous or unknown.
 */
export function matchPlace(places: Place[], input: string): Place | null {
  const { q, st } = parse(input);
  if (!q) return null;
  const same = places.filter((p) => norm(p.name) === q && (!st || p.st === st));
  return same.length === 1 ? (same[0] ?? null) : null;
}
