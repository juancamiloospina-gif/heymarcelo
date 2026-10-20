import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Star } from "lucide-react";
import { fetchReviewRequest, submitReview } from "@/lib/cloud";

/**
 * "How did I do?": the page a client opens from the link sent after a job. Public, no login, no
 * app shell. English first (clients), Spanish on request. One rating per link.
 */
export const Route = createFileRoute("/r/$token")({
  loader: async ({ params }) => ({
    info: await fetchReviewRequest(params.token).catch(() => null),
  }),
  head: () => ({
    meta: [{ title: "Rate your service" }, { name: "robots", content: "noindex" }],
  }),
  component: ReviewPage,
});

const TXT = {
  en: {
    title: (name: string) => `How did ${name} do?`,
    sub: (svc: string) => (svc ? `Rate your ${svc.toLowerCase()} service.` : "Rate the service."),
    comment: "Anything you'd like to add? (optional)",
    send: "Send rating",
    sending: "Sending…",
    thanks: "Thank you!",
    thanksSub: "Your rating was sent.",
    already: "This rating was already sent. Thank you!",
    notFound: "This link is not available.",
    error: "We couldn't send it. Please try again.",
    pick: "Tap a star",
  },
  es: {
    title: (name: string) => `¿Cómo lo hizo ${name}?`,
    sub: (svc: string) =>
      svc ? `Califica el servicio de ${svc.toLowerCase()}.` : "Califica el servicio.",
    comment: "¿Algo que quieras agregar? (opcional)",
    send: "Enviar calificación",
    sending: "Enviando…",
    thanks: "¡Gracias!",
    thanksSub: "Tu calificación fue enviada.",
    already: "Esta calificación ya fue enviada. ¡Gracias!",
    notFound: "Este enlace no está disponible.",
    error: "No pudimos enviarla. Intenta de nuevo.",
    pick: "Toca una estrella",
  },
} as const;

function ReviewPage() {
  const { info } = Route.useLoaderData();
  const { token } = Route.useParams();
  const [lang, setLang] = useState<"en" | "es">(
    typeof navigator !== "undefined" && navigator.language.startsWith("es") ? "es" : "en",
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const t = TXT[lang];

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#f6f3ee] px-5 py-10 text-[#16263a]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="h-10 rounded-full border border-[#e7e2d8] bg-white px-4 text-[14px] font-semibold"
          >
            {lang === "en" ? "ES" : "EN"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  if (!info) return shell(<p className="pt-10 text-center text-[17px]">{t.notFound}</p>);
  if (info.rating || state === "done") {
    return shell(
      <div className="pt-6 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e6f4ea] text-[#2e7d4f]">
          <Check className="size-8" />
        </span>
        <h1 className="mt-4 text-[24px] font-bold">{state === "done" ? t.thanks : t.already}</h1>
        {state === "done" ? <p className="mt-1 text-[16px] text-[#4b5b70]">{t.thanksSub}</p> : null}
      </div>,
    );
  }

  const who = info.first_name || info.business_name || "us";
  return shell(
    <form
      className="rounded-3xl border border-[#e7e2d8] bg-white p-6 text-center"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return;
        setState("sending");
        try {
          await submitReview(token, rating, comment.trim());
          setState("done");
        } catch {
          setState("error");
        }
      }}
    >
      {info.photo_url ? (
        <img
          src={info.photo_url}
          alt=""
          className="mx-auto mb-3 size-20 rounded-full object-cover object-top"
        />
      ) : null}
      <h1 className="text-[24px] font-bold leading-tight">{t.title(who)}</h1>
      <p className="mt-1 text-[16px] text-[#4b5b70]">{t.sub(info.service)}</p>
      <div className="my-5 flex justify-center gap-1" role="radiogroup" aria-label={t.pick}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}`}
            onClick={() => setRating(n)}
            className="flex size-14 items-center justify-center"
          >
            <Star
              className={`size-10 ${n <= rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#c9c3b6]"}`}
              strokeWidth={1.6}
            />
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t.comment}
        className="w-full rounded-2xl border border-[#e7e2d8] bg-[#fbfaf7] px-4 py-3 text-[16px] outline-none focus:border-[#0b3a6b]"
      />
      {state === "error" ? <p className="mt-2 text-[14px] text-[#b3261e]">{t.error}</p> : null}
      <button
        type="submit"
        disabled={!rating || state === "sending"}
        className="mt-4 h-12 w-full rounded-2xl bg-[#0b3a6b] text-[16px] font-semibold text-white disabled:opacity-50"
      >
        {state === "sending" ? t.sending : t.send}
      </button>
    </form>,
  );
}
