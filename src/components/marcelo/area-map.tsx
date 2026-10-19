import { useEffect, useRef, useState } from "react";
import { T, type Lang } from "@/lib/public-i18n";
import type { AreaPoint } from "@/lib/service-area";

/**
 * Map of the work area: a circle for the radius and one dot per ZIP code covered (so the ZIPs the
 * worker added or removed by hand show up too). The map library is loaded only when the map is
 * about to be seen, so the page stays light on a phone.
 *
 * Tiles come from OpenStreetMap's public server, fine for a pilot. To change provider, set
 * VITE_MAP_TILES_URL (and VITE_MAP_ATTRIBUTION): no code change needed.
 */
const TILES =
  (import.meta.env["VITE_MAP_TILES_URL"] as string | undefined) ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  (import.meta.env["VITE_MAP_ATTRIBUTION"] as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const NAVY = "#0b3a6b";
const METERS_PER_MILE = 1609.344;

export function AreaMap({
  center,
  points,
  radiusMi,
  lang,
}: {
  center: [number, number] | null;
  points: AreaPoint[];
  radiusMi: number;
  lang: Lang;
}) {
  const t = T[lang];
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  // Changes only when the data changes: redraw then, not on every render.
  const key = JSON.stringify([center, radiusMi, points]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && (setSeen(true), io.disconnect()),
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || !box.current) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const mod = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        const L = mod.default ?? mod;
        if (cancelled || !box.current) return;
        // zoomSnap 0.25: the area fills the map instead of jumping to a whole zoom level.
        map = L.map(box.current, {
          scrollWheelZoom: false,
          zoomSnap: 0.25,
          attributionControl: true,
        });
        L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
        const bounds = L.latLngBounds([]);
        if (center && radiusMi > 0) {
          L.circle(center, {
            radius: radiusMi * METERS_PER_MILE,
            color: NAVY,
            weight: 2,
            fillColor: NAVY,
            fillOpacity: 0.1,
          }).addTo(map);
          // Bounds from the numbers, not from the drawn circle: the map has no view yet.
          bounds.extend(L.latLng(center).toBounds(radiusMi * METERS_PER_MILE * 2));
        }
        for (const [zip, lat, lon] of points) {
          L.circleMarker([lat, lon], {
            radius: 4,
            color: "#ffffff",
            weight: 1,
            fillColor: NAVY,
            fillOpacity: 0.9,
          })
            .bindTooltip(zip)
            .addTo(map);
          bounds.extend([lat, lon]);
        }
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });
        else if (center) map.setView(center, 10);
        else map.setView([39.5, -98.35], 4); // the US: nothing to show yet
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for center, radius and points
  }, [seen, key]);

  return (
    <div className="relative isolate mt-3 h-64 overflow-hidden rounded-2xl border border-[#d9e2ee] bg-[#e5eaf0]">
      <div ref={box} role="img" aria-label={t.mapLabel} className="absolute inset-0" />
      {state !== "ready" ? (
        <p className="absolute inset-0 z-[500] flex items-center justify-center text-[15px] text-[#4b5b70]">
          {state === "error" ? t.mapError : t.mapLoading}
        </p>
      ) : null}
    </div>
  );
}
