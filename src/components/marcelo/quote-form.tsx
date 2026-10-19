import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field } from "./kit";
import { submitQuoteRequest } from "@/lib/cloud";
import { T, type Lang } from "@/lib/public-i18n";
import { covers } from "@/lib/service-area";

/** The quote request form on the public page. Sends the request to the worker through Supabase. */
export function QuoteForm({
  slug,
  businessName,
  services,
  coveredZips,
  lang,
}: {
  slug: string;
  businessName: string;
  services: string[];
  /** ZIP codes the worker covers; empty = no area defined, never warn. */
  coveredZips: string[];
  lang: Lang;
}) {
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
    // Bots fill every field: a hidden one with text means "pretend it worked".
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
      <div id="quote" className="rounded-3xl border border-[#d9e2ee] bg-white p-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[#f59e0b]" />
        <h2 className="mt-2 text-[20px] font-bold text-[#0b3a6b]">{t.done}</h2>
        <p className="mt-1 text-[16px] text-[#4b5b70]">
          {businessName} {t.doneHint}
        </p>
      </div>
    );
  }

  return (
    <form
      id="quote"
      onSubmit={(e) => void submit(e)}
      className="space-y-3 rounded-3xl border border-[#d9e2ee] bg-white p-5"
    >
      <h2 className="text-[20px] font-bold text-[#0b3a6b]">{t.formTitle}</h2>
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
      {covers(coveredZips, f.zip) === "no" ? (
        <p role="status" className="-mt-1 text-[14px] font-medium text-[#9a5b00]">
          {t.outsideNote}
        </p>
      ) : null}
      {services.length ? (
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-[#4b5b70]">{t.service}</span>
          <select
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px]"
            value={f.service}
            onChange={(e) => setF({ ...f, service: e.target.value })}
          >
            <option value="">{t.other}</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-[#4b5b70]">{t.details}</span>
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
      <button
        disabled={state === "sending"}
        className="h-12 w-full rounded-2xl bg-[#0b3a6b] text-[16px] font-semibold text-white disabled:opacity-50"
      >
        {state === "sending" ? t.sending : t.send}
      </button>
    </form>
  );
}
