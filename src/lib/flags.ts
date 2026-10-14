/**
 * Demo mode: WhatsApp/SMS are simulated and "Demo" labels are shown. Turn it off with
 * VITE_DEMO_MODE=false once real channels are connected.
 */
export const DEMO_MODE = import.meta.env["VITE_DEMO_MODE"] !== "false";

/**
 * Base URL of the public profile pages (e.g. "https://marcelo.app"). While it is empty there is
 * no page: QR codes and links open a WhatsApp chat. Once the backend serves `/p/<slug>`, set
 * VITE_PUBLIC_PROFILE_URL and `shareUrl()` starts returning the page instead.
 * Never point a printed QR at a temporary domain: the URL must not change after printing.
 */
export const PUBLIC_PROFILE_BASE_URL =
  (import.meta.env["VITE_PUBLIC_PROFILE_URL"] as string | undefined) ?? "";
