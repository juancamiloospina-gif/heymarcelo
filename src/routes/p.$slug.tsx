import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MapPin, MessageCircle, Phone } from "lucide-react";
import { Button, Card, Field } from "@/components/marcelo/kit";
import { fetchPublicProfile, submitQuoteRequest, type CloudProfile } from "@/lib/cloud";
import { formatPhone } from "@/lib/public-profile";

/**
 * Public page of one worker, opened from a QR or link. Written for the client (English first,
 * Spanish on request). It does not use the app shell or any local data: it only reads the
 * profile the worker published and sends quote requests back to them.
 */
export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const profile = await fetchPublicProfile(params.slug).catch(() => null);
    // An old slug (a printed QR) keeps working: it lands on the current address.
    if (profile && profile.slug !== params.slug) {
      throw redirect({ to: "/p/$slug", params: { slug: profile.slug }, replace: true });
    }
    return { profile };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.profile;
    const title = p
      ? `${p.business_name}${p.trade_en ? ` · ${p.trade_en}` : ""}`
      : "Page not found";
    const description = p
      ? `Get a free quote from ${p.business_name}${p.city ? ` in ${p.city}` : ""}.`
      : "This page is not available.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(p ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: PublicPage,
});

type Lang = "en" | "es";

const T = {
  en: {
    quote: "Request a free quote",
    call: "Call",
    whatsapp: "WhatsApp",
    services: "Services",
    area: "Service area",
    formTitle: "Tell us what you need",
    name: "Your name",
    phone: "Phone number",
    zip: "ZIP code",
    service: "Service",
    other: "Something else",
    details: "Details (optional)",
    send: "Send request",
    sending: "Sending…",
    done: "Request sent!",
    doneHint: "will contact you soon.",
    tooMany: "Too many requests. Please try again later.",
    error: "We could not send it. Please try again.",
    invalid: "Please enter your name and a valid phone number.",
    notFound: "This page is not available",
    notFoundHint: "The link may be old or the page was turned off.",
    powered: "Made with Marcelo",
  },
  es: {
    quote: "Pedir cotización gratis",
    call: "Llamar",
    whatsapp: "WhatsApp",
    services: "Servicios",
    area: "Zona de servicio",
    formTitle: "Cuéntanos qué necesitas",
    name: "Tu nombre",
    phone: "Tu teléfono",
    zip: "Código postal",
    service: "Servicio",
    other: "Otra cosa",
    details: "Detalles (opcional)",
    send: "Enviar solicitud",
    sending: "Enviando…",
    done: "¡Solicitud enviada!",
    doneHint: "te contactará pronto.",
    tooMany: "Demasiadas solicitudes. Intenta más tarde.",
    error: "No se pudo enviar. Intenta de nuevo.",
    invalid: "Escribe tu nombre y un teléfono válido.",
    notFound: "Esta página no está disponible",
    notFoundHint: "El enlace puede ser viejo o la página está desactivada.",
    powered: "Hecho con Marcelo",
  },
} as const;

function PublicPage() {
  const { profile } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];

  if (!profile) {
    return (
      <Shell lang={lang} setLang={setLang}>
        <Card className="text-center">
          <h1 className="text-[20px] font-bold">{t.notFound}</h1>
          <p className="mt-2 text-[16px] text-muted-foreground">{t.notFoundHint}</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell lang={lang} setLang={setLang}>
      <header className="text-center">
        <h1 className="text-[28px] font-bold leading-tight">{profile.business_name}</h1>
        {profile.trade_en || profile.city ? (
          <p className="mt-1 text-[17px] text-muted-foreground">
            {[profile.trade_en, profile.city].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </header>

      <div className="mt-5 grid gap-2">
        <a
          href="#quote"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-accent text-[16px] font-semibold text-accent-foreground"
        >
          {t.quote}
        </a>
        {profile.phone ? (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:+1${profile.phone}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[16px] font-semibold"
            >
              <Phone className="size-4" /> {t.call}
            </a>
            <a
              href={`https://wa.me/1${profile.phone}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[16px] font-semibold"
            >
              <MessageCircle className="size-4" /> {t.whatsapp}
            </a>
          </div>
        ) : null}
      </div>

      {profile.services.length ? (
        <Card className="mt-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t.services}
          </h2>
          <ul className="mt-2 space-y-1.5 text-[16px]">
            {profile.services.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-accent" /> {s}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {profile.service_area ? (
        <Card className="mt-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t.area}
          </h2>
          <p className="mt-2 flex items-start gap-2 text-[16px]">
            <MapPin className="mt-0.5 size-4 shrink-0 text-accent" /> {profile.service_area}
          </p>
        </Card>
      ) : null}

      <QuoteForm slug={slug} profile={profile} lang={lang} />
    </Shell>
  );
}

function Shell({
  children,
  lang,
  setLang,
}: {
  children: React.ReactNode;
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background px-4 pb-10 pt-4">
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-[14px] font-semibold">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`min-h-9 rounded-full px-4 ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {children}
      <p className="mt-8 text-center text-[13px] text-muted-foreground">{T[lang].powered}</p>
    </div>
  );
}

function QuoteForm({ slug, profile, lang }: { slug: string; profile: CloudProfile; lang: Lang }) {
  const t = T[lang];
  const [f, setF] = useState({
    name: "",
    phone: "",
    zip: "",
    service: "",
    description: "",
    trap: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const phone = f.phone.replace(/\D/g, "");
    if (!f.name.trim() || phone.length < 7) return setError(t.invalid);
    // Bots fill every field: a hidden one that has text means "pretend it worked".
    if (f.trap) return setState("done");
    setState("sending");
    try {
      await submitQuoteRequest(slug, {
        name: f.name,
        phone,
        zip: f.zip.replace(/\D/g, "").slice(0, 5),
        service: f.service,
        description: f.description,
      });
      setState("done");
    } catch (err) {
      setState("idle");
      setError((err as Error).message === "rate_limited" ? t.tooMany : t.error);
    }
  };

  if (state === "done") {
    return (
      <Card className="mt-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-accent" />
        <h2 id="quote" className="mt-2 text-[20px] font-bold">
          {t.done}
        </h2>
        <p className="mt-1 text-[16px] text-muted-foreground">
          {profile.business_name} {t.doneHint}
        </p>
      </Card>
    );
  }

  return (
    <form id="quote" onSubmit={(e) => void submit(e)} className="surface mt-5 space-y-3 p-4">
      <h2 className="text-[20px] font-bold">{t.formTitle}</h2>
      <Field
        label={t.name}
        autoComplete="name"
        maxLength={80}
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
      />
      <Field
        label={t.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={20}
        value={f.phone}
        onChange={(e) => setF({ ...f, phone: e.target.value })}
      />
      <Field
        label={t.zip}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        value={f.zip}
        onChange={(e) => setF({ ...f, zip: e.target.value })}
      />
      {profile.services.length ? (
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
            {t.service}
          </span>
          <select
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px]"
            value={f.service}
            onChange={(e) => setF({ ...f, service: e.target.value })}
          >
            <option value="">{t.other}</option>
            {profile.services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
          {t.details}
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-[16px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </label>
      {/* Honeypot: people never see it. */}
      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] size-0 opacity-0"
        name="website"
        value={f.trap}
        onChange={(e) => setF({ ...f, trap: e.target.value })}
      />
      {error ? <p className="text-[15px] font-medium text-destructive">{error}</p> : null}
      <Button className="w-full" disabled={state === "sending"}>
        {state === "sending" ? t.sending : t.send}
      </Button>
      {profile.phone && profile.show_phone ? (
        <p className="text-center text-[14px] text-muted-foreground">
          {formatPhone(profile.phone)}
        </p>
      ) : null}
    </form>
  );
}
