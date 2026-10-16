/**
 * What a client sees about the user: one plain object (`PublicProfile`) built from the local
 * state, and one function (`shareUrl`) that decides where a QR or link points.
 *
 * This is the seam for the backend. Today the object is built on the phone and the link opens
 * WhatsApp. Later the same object becomes the row the server stores for `/p/<slug>`, and
 * `shareUrl` returns the page URL. QR, flyer and any future screen only use these two things.
 */
import { PUBLIC_PROFILE_BASE_URL } from "./flags";
import { digits, type MarceloState } from "./marcelo-data";

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
};

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
 * The one place that decides what a QR or link opens. With a published page it is the page
 * (`/p/<slug>`); before that, a WhatsApp chat. Empty string = nothing to share yet.
 */
export function shareUrl(p: PublicProfile, src: ShareSource, base = publicBase()): string {
  if (base && p.slug) return `${base}/p/${p.slug}?src=${src}`;
  if (!p.phone) return "";
  const text = `Hi ${p.firstName}! I'd like a quote${p.tradeEn ? ` for ${p.tradeEn.toLowerCase()}` : ""}.`;
  return `https://wa.me/1${p.phone}?text=${encodeURIComponent(text)}`;
}

/** True when `shareUrl` returns the public page and not the WhatsApp fallback. */
export function opensPage(p: PublicProfile, base = publicBase()): boolean {
  return Boolean(base && p.slug);
}

/** "6265550100" → "(626) 555-0100". Anything else is returned as it is. */
export function formatPhone(d: string): string {
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
}
