import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  markImported,
  pullNewRequests,
  pullReviews,
  useCloudSession,
  type CloudRequest,
} from "@/lib/cloud";

const EVERY_MS = 60_000;

/** What the client asked for, as a first message in English (the app translates it on arrival). */
function requestText(r: CloudRequest): string {
  const parts = [
    r.service ? `I need a quote for: ${r.service}.` : "I'd like a quote.",
    r.description,
    r.zip ? `ZIP: ${r.zip}.` : "",
    r.outside_area ? "(Outside your service area.)" : "",
  ];
  return parts.filter(Boolean).join(" ").trim();
}

/**
 * Brings the quote requests sent from the public page into Mensajes, as new conversations.
 * Runs while the app is open (on open, every minute and when the tab comes back). With the app
 * closed nothing arrives yet: that needs push notifications.
 */
export function CloudSync() {
  const { state, receiveClientMessage, updateJob, clientById } = useMarcelo();
  const jobsRef = useRef(state.jobs);
  jobsRef.current = state.jobs;
  const patchJob = useRef(updateJob);
  patchJob.current = updateJob;
  const clientRef = useRef(clientById);
  clientRef.current = clientById;
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
          toast.success(
            r.outside_area
              ? `Nueva solicitud de ${r.name} (fuera de tu zona)`
              : `Nueva solicitud de ${r.name}`,
          );
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

  // Ratings sent from the survey link come back onto the job they belong to.
  useEffect(() => {
    if (!signedIn) return;
    let stop = false;
    const pull = async () => {
      try {
        const reviews = await pullReviews();
        if (stop) return;
        for (const r of reviews) {
          const job = jobsRef.current.find((j) => j.id === r.job_ref);
          if (!job || job.ratedAt === r.rated_at) continue;
          patchJob.current(job.id, {
            rating: r.rating,
            ratingComment: r.comment || undefined,
            ratedAt: r.rated_at,
          });
          if (!job.ratedAt) {
            const name = clientRef.current(job.clientId)?.name.split(" ")[0] ?? "Tu cliente";
            toast.success(
              `${name} te calificó con ${r.rating} ${r.rating === 1 ? "estrella" : "estrellas"}`,
            );
          }
        }
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
  }, [signedIn]);

  return null;
}
