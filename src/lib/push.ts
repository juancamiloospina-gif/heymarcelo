/**
 * Avisos en el teléfono (Web Push) para las solicitudes de cotización: se activan una vez por
 * teléfono y llegan aunque la app esté cerrada. En iPhone solo funcionan si la app está agregada
 * a la pantalla de inicio (sin App Store hace falta eso).
 */
import { cloud } from "./cloud";

const URL_BASE = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const ANON = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export type PushState = "unsupported" | "needs_install" | "denied" | "off" | "on";

/** The key the browser needs, in the format `subscribe` wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const pushCapable = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

/** What the card should show on this phone right now. */
export async function pushState(): Promise<PushState> {
  // On iPhone the permission API only exists once the app is on the home screen.
  if (isIOS() && !isStandalone()) return "needs_install";
  if (!pushCapable()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

async function publicKey(): Promise<string> {
  if (!URL_BASE || !ANON) throw new Error("cloud_disabled");
  const r = await fetch(`${URL_BASE}/functions/v1/notify-quote?action=key`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!r.ok) throw new Error(`push_key_${r.status}`);
  const { publicKey: key } = (await r.json()) as { publicKey?: string };
  if (!key) throw new Error("push_key_missing");
  return key;
}

/** Asks permission, subscribes this phone and saves it. Throws "permission_denied" if refused. */
export async function enablePush(): Promise<void> {
  if (!cloud) throw new Error("cloud_disabled");
  const { data: auth } = await cloud.auth.getUser();
  if (!auth.user) throw new Error("not_signed_in");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission_denied");

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(await publicKey()),
    }));

  const json = sub.toJSON();
  const { error } = await cloud.from("push_subscriptions").upsert(
    {
      owner_id: auth.user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

/** Stops the notifications on this phone (and forgets it on the server). Never throws. */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await cloud?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // Best effort: a stale phone is cleaned up by the server on the next failed send.
  }
}

/** Sends a test notification to all of the user's phones. Returns how many phones got it. */
export async function sendTestPush(): Promise<{ phones: number; sent: number }> {
  if (!cloud || !URL_BASE || !ANON) throw new Error("cloud_disabled");
  const { data } = await cloud.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not_signed_in");
  const r = await fetch(`${URL_BASE}/functions/v1/notify-quote?action=test`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`push_test_${r.status}`);
  return (await r.json()) as { phones: number; sent: number };
}
