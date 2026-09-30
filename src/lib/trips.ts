/**
 * Mileage per job: the phone's position when the user taps "Ir" and when they tap "Terminé".
 * Browsers stop GPS while the screen is locked, so this is the straight-line distance;
 * the user can always correct the miles before saving.
 */
const KEY = "marcelo.trips.v1";

type Point = { lat: number; lng: number; at: number };

function readAll(): Record<string, Point> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, Point>;
  } catch {
    return {};
  }
}

function writeAll(v: Record<string, Point>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

function here(): Promise<Point | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

const milesBetween = (a: Point, b: Point) => {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export async function startTripFor(jobId: string) {
  const p = await here();
  if (!p) return false;
  writeAll({ ...readAll(), [jobId]: p });
  return true;
}

export const hasTrip = (jobId: string) =>
  typeof window !== "undefined" && Boolean(readAll()[jobId]);

/** Miles since "Ir", rounded to 0.1, or null when there was no start point or no GPS. */
export async function endTripFor(jobId: string): Promise<number | null> {
  const all = readAll();
  const start = all[jobId];
  if (!start) return null;
  const end = await here();
  delete all[jobId];
  writeAll(all);
  if (!end) return null;
  return Math.round(milesBetween(start, end) * 10) / 10;
}
