/**
 * What a client sees about the user: one plain object (`PublicProfile`) built from the local
 * state, and one function (`shareUrl`) that decides where a QR or link points.
 *
 * This is the seam for the backend. Today the object is built on the phone and the link opens
 * WhatsApp. Later the same object becomes the row the server stores for `/p/<slug>`, and
 * `shareUrl` returns the page URL. QR, flyer and any future screen only use these two things.
 */
import { PUBLIC_PROFILE_BASE_URL } from "./flags";
import { digits, type MarceloState, type ServiceKind, type TraitKey } from "./marcelo-data";

export type PublicProfile = {
  /** Permanent id in the page URL. Assigned by the server; empty until there is a backend. */
  slug?: string;
  businessName: string;
  firstName: string;
  /** Trade in English ("Landscaping"). Empty when we cannot translate it: better none than Spanish. */
  tradeEn: string;
  city: string;
  serviceArea: string;
  /** Service names in English, as the client reads them. No prices: they go stale in print. */
  services: string[];
  /** US number, digits only ("6265550100"). Empty when WhatsApp is not connected. */
  phone: string;
  showPhone: boolean;
  photoUrl: string;
  tagline: string;
  bio: string;
  traits: TraitKey[];
  showPrices: boolean;
  /** Services with their icon kind and lowest price, as the page lists them. */
  serviceItems: ServiceItem[];
};

export type ServiceItem = { name: string; kind: ServiceKind; fromPrice?: number | undefined };

/** Where the visit came from, so it can be measured once there is a page (`?src=`). */
export type ShareSource = "qr" | "flyer" | "link";

const MAX_SERVICES = 6;

/** Common trades, keyed without accents. The profile has no English trade field yet. */
const TRADES_EN: Record<string, string> = {
  jardineria: "Landscaping",
  jardinero: "Landscaping",
  paisajismo: "Landscaping",
  plomeria: "Plumbing",
  fontaneria: "Plumbing",
  plomero: "Plumbing",
  limpieza: "Cleaning",
  "limpieza de casas": "House cleaning",
  pintura: "Painting",
  pintor: "Painting",
  electricidad: "Electrical",
  electricista: "Electrical",
  carpinteria: "Carpentry",
  carpintero: "Carpentry",
  construccion: "Construction",
  techos: "Roofing",
  albanileria: "Masonry",
  mudanzas: "Moving",
};

export function tradeInEnglish(trade: string): string {
  const key = trade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return TRADES_EN[key] ?? "";
}

/** Lowest price of a service: the smallest size price when priced by size, else the flat price. */
function serviceItems(state: MarceloState): ServiceItem[] {
  const seen = new Set<string>();
  const items: ServiceItem[] = [];
  for (const sv of state.services) {
    const name = sv.nameEn.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const prices = sv.sizes ? Object.values(sv.sizes) : [sv.price];
    const from = Math.min(...prices);
    items.push({
      name,
      kind: sv.kind,
      fromPrice: Number.isFinite(from) && from > 0 ? from : undefined,
    });
  }
  return items.slice(0, 12);
}

export function buildPublicProfile(state: MarceloState): PublicProfile {
  const { profile } = state;
  const services = [...new Set(state.services.map((s) => s.nameEn.trim()).filter(Boolean))];
  return {
    ...(profile.publicSlug ? { slug: profile.publicSlug } : {}),
    businessName: profile.name.trim(),
    firstName: profile.name.trim().split(" ")[0] ?? "",
    tradeEn: tradeInEnglish(profile.trade),
    city: profile.city.trim(),
    serviceArea: (profile.serviceArea ?? "").trim(),
    services: services.slice(0, MAX_SERVICES),
    phone: digits(state.connections.whatsapp.number ?? ""),
    showPhone: profile.showPhoneOnFlyer ?? false,
    photoUrl: profile.photoUrl ?? "",
    tagline: (profile.tagline ?? "").trim(),
    bio: (profile.bio ?? "").trim(),
    traits: profile.traits ?? [],
    showPrices: profile.showPrices ?? true,
    serviceItems: serviceItems(state),
  };
}

/**
 * Where the public pages live. The configured domain wins; otherwise the address the app is
 * running on (the published site). Never localhost: a QR printed there would be useless.
 */
export function publicBase(): string {
  if (PUBLIC_PROFILE_BASE_URL) return PUBLIC_PROFILE_BASE_URL.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  const { hostname, origin } = window.location;
  return /^(localhost|127\.|\[::1\])/.test(hostname) ? "" : origin;
}

/**
 * The one place that decides what a QR or link opens: the user's public page (`/p/<slug>`).
 * Empty string = there is nothing to share yet, because the page is not published (or the app
 * is not running on a public address). No page, no QR.
 */
export function shareUrl(p: PublicProfile, src: ShareSource, base = publicBase()): string {
  return base && p.slug ? `${base}/p/${p.slug}?src=${src}` : "";
}

/** "6265550100" → "(626) 555-0100". Anything else is returned as it is. */
export function formatPhone(d: string): string {
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
}
