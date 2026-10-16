import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useMarcelo } from "@/lib/marcelo-store";
import { markImported, pullNewRequests, useCloudSession, type CloudRequest } from "@/lib/cloud";

const EVERY_MS = 60_000;

/** What the client asked for, as a first message in English (the app translates it on arrival). */
function requestText(r: CloudRequest): string {
  const parts = [
    r.service ? `I need a quote for: ${r.service}.` : "I'd like a quote.",
    r.description,
    r.zip ? `ZIP: ${r.zip}.` : "",
  ];
  return parts.filter(Boolean).join(" ").trim();
}

/**
 * Brings the quote requests sent from the public page into Mensajes, as new conversations.
 * Runs while the app is open (on open, every minute and when the tab comes back). With the app
 * closed nothing arrives yet: that needs push notifications.
 */
export function CloudSync() {
  const { state, receiveClientMessage } = useMarcelo();
  const session = useCloudSession();
  const receive = useRef(receiveClientMessage);
  receive.current = receiveClientMessage;
  const seen = useRef(new Set<string>());
  const published = Boolean(state.profile.publicSlug);
  const signedIn = Boolean(session);

  useEffect(() => {
    if (!published || !signedIn) return;
    let stop = false;
    const pull = async () => {
      try {
        const fresh = (await pullNewRequests()).filter((r) => !seen.current.has(r.id));
        if (stop || !fresh.length) return;
        for (const r of fresh) {
          seen.current.add(r.id);
          receive.current({
            channel: "whatsapp",
            contactName: r.name,
            phone: r.phone,
            text: requestText(r),
          });
          toast.success(`Nueva solicitud de ${r.name}`);
        }
        await markImported(fresh.map((r) => r.id));
      } catch {
        // No connection or expired session: try again at the next turn.
      }
    };
    void pull();
    const timer = setInterval(() => void pull(), EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && void pull();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [published, signedIn]);

  return null;
}
