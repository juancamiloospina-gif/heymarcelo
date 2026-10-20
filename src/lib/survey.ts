/**
 * "¿Cómo lo hice?": after a job is finished the client gets a link to rate the service.
 * The link opens `/r/<token>` (public, no login); the token is created in the cloud so the rating
 * comes back tied to this job and this client. Needs the user signed in (Mi página) and the app
 * running on its public address; without either there is no link to send, and we say why.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { createReviewRequest, cloudEnabled, cloud } from "./cloud";
import { publicBase } from "./public-profile";
import { useMarcelo } from "./marcelo-store";

export type SurveyResult =
  | { ok: true; url: string }
  | { ok: false; reason: "no_phone" | "no_cloud" | "signed_out" | "no_public_url" | "error" };

export const surveyReasonText: Record<Exclude<SurveyResult, { ok: true }>["reason"], string> = {
  no_phone: "El cliente no tiene teléfono: no se pudo enviar la encuesta.",
  no_cloud: "La encuesta necesita la conexión en la nube, que no está activa.",
  signed_out: "Para enviar encuestas, entra con tu correo en Mi página.",
  no_public_url: "La encuesta solo funciona en la app publicada (no en una dirección de prueba).",
  error: "No pude crear el enlace de la encuesta. Intenta de nuevo.",
};

/** Hook: `request(jobId)` creates the link and queues the survey message for the job's client. */
export function useSurveyRequest() {
  const { state, clientById, queueJobMessage } = useMarcelo();
  return useCallback(
    async (jobId: string, opts: { manual?: boolean } = {}): Promise<SurveyResult> => {
      const job = state.jobs.find((j) => j.id === jobId);
      const client = clientById(job?.clientId);
      const fail = (reason: Exclude<SurveyResult, { ok: true }>["reason"]): SurveyResult => {
        // Quiet when it is automatic and simply not available; loud when the user asked for it.
        if (opts.manual) toast.error(surveyReasonText[reason]);
        return { ok: false, reason };
      };
      if (!job || !client?.phone) return fail("no_phone");
      if (!opts.manual && job.sent?.survey) return { ok: false, reason: "error" };
      if (!cloudEnabled || !cloud) return fail("no_cloud");
      const base = publicBase();
      if (!base) return fail("no_public_url");
      const { data } = await cloud.auth.getSession();
      if (!data.session) return fail("signed_out");
      try {
        const token = await createReviewRequest({
          jobId: job.id,
          clientId: client.id,
          clientName: client.name,
          service: job.service,
          jobDate: job.date,
        });
        const url = `${base}/r/${token}`;
        queueJobMessage("survey", job.id, undefined, url);
        return { ok: true, url };
      } catch {
        return fail("error");
      }
    },
    [state.jobs, clientById, queueJobMessage],
  );
}
