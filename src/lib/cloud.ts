/**
 * The only door to Supabase (public profile + quote requests). Everything else in the app stays
 * on the phone. The anon key is public: what it can do is decided by the row-level-security
 * rules in `supabase/migrations`. Without the two env vars the app works as before.
 */
import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import type { PublicProfile } from "./public-profile";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export const cloudEnabled = Boolean(url && key);

export const cloud =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: typeof window !== "undefined",
          autoRefreshToken: typeof window !== "undefined",
          // Needed to finish "Continuar con Google / Apple / Microsoft": the provider sends the
          // user back to the app with the session in the address.
          detectSessionInUrl: true,
        },
      })
    : null;

function need() {
  if (!cloud) throw new Error("cloud_disabled");
  return cloud;
}

/** "Carlos Ramírez Landscaping" → "carlos-ramirez-landscaping" (3–40 chars, a–z, 0–9, dashes). */
export function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : "";
}

export const isValidSlug = (s: string) =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 40;

/** Public page as the server returns it. Phone is empty unless the owner chose to show it. */
/** `from_price` is what older pages saved for the flat price; new ones use `price` and `sizes`. */
export type CloudServiceItem = {
  name: string;
  kind: string;
  price?: number;
  from_price?: number;
  sizes?: { chico: number; mediano: number; grande: number };
};

export type CloudProfile = {
  slug: string;
  business_name: string;
  first_name: string;
  trade_en: string;
  city: string;
  service_area: string;
  services: string[];
  phone: string;
  show_phone: boolean;
  photo_url: string;
  tagline: string;
  tagline_en: string;
  bio: string;
  bio_en: string;
  traits: string[];
  show_prices: boolean;
  service_items: CloudServiceItem[];
  gallery: string[];
  area_center_zip: string;
  area_radius_mi: number;
  service_zips: string[];
  area_geo: unknown;
};

export async function fetchPublicProfile(slug: string): Promise<CloudProfile | null> {
  const { data, error } = await need().rpc("get_public_profile", { p_slug: slug });
  if (error) throw error;
  const rows = data as CloudProfile[] | null;
  return rows?.[0] ?? null;
}

export type QuoteInput = {
  name: string;
  phone: string;
  zip: string;
  service: string;
  description: string;
};

/** Throws "rate_limited" or "profile_not_found" (as the message) when the server says so. */
export async function submitQuoteRequest(slug: string, q: QuoteInput): Promise<void> {
  const { error } = await need().rpc("submit_quote_request", {
    p_slug: slug,
    p_name: q.name,
    p_phone: q.phone,
    p_zip: q.zip,
    p_service: q.service,
    p_description: q.description,
  });
  if (error) throw new Error(error.message);
}

/** The row that goes to the server for a page (everything but the owner). */
export function profileRow(p: PublicProfile, slug: string, active = true) {
  return {
    slug,
    active,
    business_name: p.businessName,
    first_name: p.firstName,
    trade_en: p.tradeEn,
    city: p.city,
    service_area: p.serviceArea,
    services: p.services,
    phone: p.phone,
    show_phone: p.showPhone,
    photo_url: p.photoUrl,
    tagline: p.tagline,
    tagline_en: p.taglineEn,
    bio: p.bio,
    bio_en: p.bioEn,
    traits: p.traits,
    show_prices: p.showPrices,
    gallery: p.gallery,
    area_center_zip: p.areaCenterZip,
    area_radius_mi: p.areaRadiusMi,
    service_zips: p.areaZips,
    area_geo: p.areaGeo,
    service_items: p.serviceItems.map((i) => ({
      name: i.name,
      kind: i.kind,
      ...(i.price ? { price: i.price } : {}),
      ...(i.sizes ? { sizes: i.sizes } : {}),
    })),
  };
}

/** Identifies what is published: when it changes, the page is out of date. */
export const publishKey = (p: PublicProfile, slug: string) => JSON.stringify(profileRow(p, slug));

/** Create or update the owner's page. Throws "slug_taken" when the slug belongs to someone else. */
export async function publishProfile(p: PublicProfile, slug: string, active = true): Promise<void> {
  const c = need();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error("not_signed_in");
  const { error } = await c
    .from("profiles")
    .upsert({ owner_id: auth.user.id, ...profileRow(p, slug, active) }, { onConflict: "owner_id" });
  if (error) throw new Error(error.code === "23505" ? "slug_taken" : error.message);
}

const PHOTO_BUCKET = "profile-photos";

/** Uploads the (already compressed) profile photo to the user's own folder; returns its URL. */
export async function uploadProfilePhoto(photo: Blob): Promise<string> {
  const c = need();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error("not_signed_in");
  const path = `${auth.user.id}/profile.jpg`;
  const { error } = await c.storage
    .from(PHOTO_BUCKET)
    .upload(path, photo, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw new Error(error.message);
  // The path never changes, so the version in the URL makes browsers fetch the new photo.
  return `${c.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

export async function removeProfilePhoto(): Promise<void> {
  const c = need();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error("not_signed_in");
  const { error } = await c.storage.from(PHOTO_BUCKET).remove([`${auth.user.id}/profile.jpg`]);
  if (error) throw new Error(error.message);
}

/** Storage path of one of our photos, from its public URL (`…/profile-photos/<uid>/<file>?v=…`). */
export function photoPathFromUrl(url: string): string | null {
  const m = /\/profile-photos\/([^?#]+)/.exec(url);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export const MAX_WORK_PHOTOS = 6;

/** Uploads a (compressed) photo of the user's work; returns its public URL. */
export async function uploadWorkPhoto(photo: Blob): Promise<string> {
  const c = need();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error("not_signed_in");
  // A new name each time: browsers never show an older photo by mistake.
  const path = `${auth.user.id}/work-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await c.storage
    .from(PHOTO_BUCKET)
    .upload(path, photo, { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw new Error(error.message);
  return c.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes a work photo from Storage. Only the user's own folder is allowed by the rules. */
export async function removeWorkPhoto(url: string): Promise<void> {
  const c = need();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) throw new Error("not_signed_in");
  const path = photoPathFromUrl(url);
  if (!path || !path.startsWith(`${auth.user.id}/`)) return;
  const { error } = await c.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

export type CloudRequest = {
  id: string;
  name: string;
  phone: string;
  zip: string;
  service: string;
  description: string;
  created_at: string;
  outside_area: boolean;
};

export async function pullNewRequests(): Promise<CloudRequest[]> {
  const { data, error } = await need()
    .from("quote_requests")
    .select("id,name,phone,zip,service,description,created_at,outside_area")
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return data as CloudRequest[];
}

export async function markImported(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await need()
    .from("quote_requests")
    .update({ status: "imported" })
    .in("id", ids);
  if (error) throw error;
}

export const sendCode = async (email: string) => {
  const { error } = await need().auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
};

/** Sign-in providers the app offers. "azure" is how Supabase names Microsoft (Outlook, Office 365). */
export type SocialProvider = "google" | "apple" | "azure";

/**
 * Which sign-in methods are switched on in the Supabase project (public settings endpoint).
 * Unknown (offline, error) counts as "on" so a hiccup never hides a working method.
 */
export async function enabledProviders(): Promise<Record<SocialProvider, boolean>> {
  const all = { google: true, apple: true, azure: true };
  if (!url || !key) return all;
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!r.ok) return all;
    const j = (await r.json()) as { external?: Record<string, boolean> };
    const ext = j.external ?? {};
    return {
      google: "google" in ext ? Boolean(ext["google"]) : all.google,
      apple: "apple" in ext ? Boolean(ext["apple"]) : all.apple,
      azure: "azure" in ext ? Boolean(ext["azure"]) : all.azure,
    };
  } catch {
    return all;
  }
}

/** Leaves for the provider's page and comes back to the app already signed in. */
export async function signInWithProvider(provider: SocialProvider): Promise<void> {
  const { error } = await need().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/`,
      ...(provider === "azure" ? { scopes: "email" } : {}),
    },
  });
  if (error) throw error;
}

export const verifyCode = async (email: string, token: string) => {
  const { error } = await need().auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
};

export const signOut = async () => {
  // This phone stops getting the account's alerts (best effort) before the session goes away.
  try {
    const { disablePush } = await import("./push");
    await disablePush();
  } catch {
    // Not supported here: nothing to stop.
  }
  await need().auth.signOut();
};

/**
 * Deletes the signed-in user's cloud account: the public page, its address and the quote
 * requests it received. Data on the phone is not touched. Required by the App Store.
 */
export async function deleteAccount(): Promise<void> {
  const c = need();
  // Photos live in Storage, outside the database cascade: remove them first (best effort).
  const { data: auth } = await c.auth.getUser();
  if (auth.user) {
    const { data: files } = await c.storage.from(PHOTO_BUCKET).list(auth.user.id);
    if (files?.length) {
      await c.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${auth.user.id}/${f.name}`));
    }
  }
  const { error } = await c.rpc("delete_my_account");
  if (error) throw new Error(error.message);
  // The user no longer exists on the server: only clear the session stored on this device.
  await c.auth.signOut({ scope: "local" });
}

/** Current Supabase session (undefined while loading, null when signed out). */
export function useCloudSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!cloud) {
      setSession(null);
      return;
    }
    void cloud.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = cloud.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/* ——— Ratings ("¿Cómo lo hice?") ——— */

export type ReviewJobInput = {
  jobId: string;
  clientId: string;
  clientName: string;
  service: string;
  jobDate: string;
};

/** Creates (or returns the existing) survey link token for a job. One token per job. */
export async function createReviewRequest(i: ReviewJobInput): Promise<string> {
  const { data, error } = await need().rpc("create_review_request", {
    p_job_ref: i.jobId,
    p_client_ref: i.clientId,
    p_client_name: i.clientName,
    p_service: i.service,
    p_job_date: i.jobDate,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export type CloudReview = {
  job_ref: string;
  client_ref: string;
  rating: number;
  comment: string;
  rated_at: string;
};

/** Ratings clients have sent for the signed-in user's jobs. */
export async function pullReviews(): Promise<CloudReview[]> {
  const { data, error } = await need()
    .from("review_requests")
    .select("job_ref,client_ref,rating,comment,rated_at")
    .not("rated_at", "is", null)
    .order("rated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as CloudReview[];
}

export type ReviewRequestInfo = {
  business_name: string;
  first_name: string;
  photo_url: string;
  client_first_name: string;
  service: string;
  rating: number | null;
};

/** What the client sees when opening the link. Null when the link does not exist. */
export async function fetchReviewRequest(token: string): Promise<ReviewRequestInfo | null> {
  const { data, error } = await need().rpc("get_review_request", { p_token: token });
  if (error) throw error;
  const rows = data as ReviewRequestInfo[] | null;
  return rows?.[0] ?? null;
}

/** The client's rating. Returns false when this link was already used. */
export async function submitReview(token: string, rating: number, comment: string) {
  const { data, error } = await need().rpc("submit_review", {
    p_token: token,
    p_rating: rating,
    p_comment: comment,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}
