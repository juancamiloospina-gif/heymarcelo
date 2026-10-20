import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Pencil,
  Sparkles,
  Briefcase,
  Check,
  CheckCircle2,
  Database,
  MapPin,
  ShieldCheck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  loadPlaces,
  matchPlace,
  placeValue,
  searchPlaces,
  stateName,
  type Place,
} from "@/lib/places";
import { cn } from "@/lib/utils";
import logo from "@/assets/marcelo-logo.png";
import mark from "@/assets/marcelo-mark.png";
import character from "@/assets/marcelo-character.png";
import wave from "@/assets/marcelo-character-wave.png";

/** What Marcelo promises, in three short lines (the long version lives in Configuración). */
const trust: { icon: LucideIcon; tone: string; title: string }[] = [
  { icon: Database, tone: "bg-peach text-accent", title: "Tus datos son tuyos" },
  { icon: CheckCircle2, tone: "bg-brand-soft text-sky", title: "Tú apruebas los cambios" },
  { icon: ShieldCheck, tone: "bg-success/12 text-success", title: "Tu negocio sigue en tus manos" },
];

// Common trades as one-tap chips; any other trade is typed in the field above.
const TRADE_OPTIONS = [
  "Jardinería",
  "Limpieza de casas",
  "Plomería",
  "Electricidad",
  "Pintura",
  "Construcción",
  "Mudanzas",
  "Reparaciones",
] as const;

/** One phone-sized column, centered, so it never looks like a desktop form. */
function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-background">
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

const PrimaryButton = ({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
  <button
    {...props}
    className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-[18px] font-bold text-accent-foreground shadow-[0_8px_20px_-6px_color-mix(in_oklch,var(--accent)_60%,transparent)] transition-transform active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
  >
    {children}
  </button>
);

export function Onboarding() {
  const { setProfile } = useMarcelo();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(-1);
  const [values, setValues] = useState({ name: "", trade: "", city: "" });
  // City check (step 3): the US places list loads only when that step opens.
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [placesFailed, setPlacesFailed] = useState(false);
  const [unlisted, setUnlisted] = useState(false);
  useEffect(() => {
    if (step !== 2 || places) return;
    loadPlaces()
      .then(setPlaces)
      .catch(() => setPlacesFailed(true));
  }, [step, places]);
  const typedCity = values.city;
  const matched = useMemo(
    () => (places ? matchPlace(places, typedCity) : null),
    [places, typedCity],
  );
  const suggestions = useMemo(
    () => (places && !matched ? searchPlaces(places, typedCity) : []),
    [places, matched, typedCity],
  );

  if (step === -1) {
    return (
      <Frame>
        <img src={logo} alt="Marcelo" className="mx-auto h-12 w-auto shrink-0" />
        <div className="flex min-h-[150px] flex-1 items-center justify-center py-3">
          <img
            src={wave}
            alt=""
            aria-hidden
            className="max-h-[250px] w-auto max-w-[90%] object-contain"
          />
        </div>
        <div className="shrink-0 text-center">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-foreground">
            Tu trabajo, más simple.
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[16px] leading-snug text-muted-foreground">
            Háblame en español. Yo le contesto a tus clientes en inglés.
          </p>
        </div>
        <div className="mt-5 shrink-0 divide-y divide-border rounded-[1.5rem] bg-card px-4 shadow-[var(--shadow-card)]">
          {trust.map(({ icon: Icon, title, tone }) => (
            <div key={title} className="flex items-center gap-4 py-3">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full",
                  tone,
                )}
              >
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <p className="text-[16px] font-bold">{title}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 shrink-0">
          <PrimaryButton onClick={() => setStep(0)}>
            Empezar <ArrowRight className="size-5" />
          </PrimaryButton>
          <p className="mt-3 text-center text-[14px] text-muted-foreground">
            Toma menos de 1 minuto
          </p>
        </div>
      </Frame>
    );
  }

  const keys = ["name", "trade", "city"] as const;
  const key = keys[step] ?? "name";
  const value = values[key];
  const set = (v: string) => {
    if (key === "city") setUnlisted(false);
    setValues({ ...values, [key]: v });
  };
  const last = step === keys.length - 1;
  // The last step needs a city we recognize; if the list can't load or the user insists, text is fine.
  const cityOk = !last || Boolean(matched) || unlisted || placesFailed;

  const copy = [
    {
      title: "¿Cómo te llamas?",
      sub: "Así sabré cómo hablarte.",
      placeholder: "Carlos",
      icon: User,
    },
    {
      title: "¿Qué tipo de trabajo haces?",
      sub: "",
      placeholder: "Escribe tu oficio",
      icon: Briefcase,
    },
    {
      title: "¿En qué ciudad trabajas?",
      sub: "Así adapto tus mensajes a tu zona.",
      placeholder: "Los Ángeles, CA",
      icon: MapPin,
    },
  ][step]!;
  const Icon = copy.icon;

  return (
    <Frame>
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim() || !cityOk) return;
          if (!last) setStep(step + 1);
          else {
            setProfile({
              ...values,
              city: matched ? placeValue(matched) : value.trim(),
              onboarded: true,
              tourDone: false,
            });
            // Always land on Inicio, whatever address the app was opened from.
            navigate({ to: "/", replace: true });
          }
        }}
      >
        <div className="flex items-center justify-between">
          <img src={logo} alt="Marcelo" className="h-10 w-auto" />
          <span className="text-[14px] font-medium text-muted-foreground">
            Paso {step + 1} de 3
          </span>
        </div>
        <div className="mt-4 flex gap-2" aria-hidden>
          {keys.map((k, i) => (
            <span
              key={k}
              className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-accent" : "bg-border")}
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col pt-6">
          {step === 0 ? <ChatIllustration /> : null}
          <h1
            className={cn(
              "text-[28px] font-extrabold leading-tight tracking-tight text-foreground",
              step === 0 && "mt-4 text-center",
            )}
          >
            {copy.title}
          </h1>
          {copy.sub ? (
            <p
              className={cn("mt-1 text-[16px] text-muted-foreground", step === 0 && "text-center")}
            >
              {copy.sub}
            </p>
          ) : null}
          {step === 1 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-soft p-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-sky">
                <Sparkles className="size-5" />
              </span>
              <p className="text-[15px] leading-snug">
                <b>Marcelo funciona para cualquier oficio.</b>{" "}
                <span className="text-muted-foreground">
                  Plomería, pintura, mudanzas… o el tuyo. Puedes poner varios.
                </span>
              </p>
            </div>
          ) : null}

          <label className="mt-6 flex h-16 items-center gap-3 rounded-full border-2 border-accent/70 bg-card pl-2.5 pr-3 shadow-[var(--shadow-card)] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-peach text-accent">
              <Icon className="size-5" />
            </span>
            <input
              ref={inputRef}
              autoFocus
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={copy.placeholder}
              autoCapitalize="words"
              autoComplete={step === 0 ? "given-name" : "off"}
              enterKeyHint={last ? "done" : "next"}
              aria-label={copy.title}
              className="h-full min-w-0 flex-1 bg-transparent text-[18px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
            />
            {value ? (
              <button
                type="button"
                aria-label="Borrar"
                onClick={() => set("")}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            ) : null}
          </label>

          {step === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-sky">
                <ShieldCheck className="size-5" />
              </span>
              <p className="text-[15px] leading-snug text-muted-foreground">
                Usaré este nombre solo para personalizar tu experiencia.
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="mt-5">
              <p className="mb-2.5 text-[15px] font-bold text-muted-foreground">
                O toca uno para empezar:
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Oficios comunes">
                {TRADE_OPTIONS.map((o) => {
                  const on = value.trim().toLowerCase() === o.toLowerCase();
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(o)}
                      className={cn(
                        "flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-bold shadow-[var(--shadow-card)] transition-colors",
                        on
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-transparent bg-card",
                      )}
                    >
                      {on ? <Check className="size-4" strokeWidth={3} /> : null}
                      {o}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    set("");
                    inputRef.current?.focus();
                  }}
                  className="flex h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-accent/60 px-4 text-[15px] font-bold text-accent"
                >
                  <Pencil className="size-4" /> Otro oficio
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-4 space-y-3">
              {matched ? (
                <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sky">
                    <MapPin className="size-5" />
                  </span>
                  <p className="flex-1 text-[17px] font-bold">
                    {matched.name}, {stateName(matched.st)}
                  </p>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                </div>
              ) : (
                <>
                  {suggestions.map((p) => (
                    <button
                      key={`${p.name}-${p.st}`}
                      type="button"
                      onClick={() => set(placeValue(p))}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-card)] active:scale-[0.99]"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sky">
                        <MapPin className="size-5" />
                      </span>
                      <span className="flex-1 text-[17px] font-bold">
                        {p.name}, {stateName(p.st)}
                      </span>
                    </button>
                  ))}
                  {places && value.trim().length >= 3 && suggestions.length === 0 && !unlisted ? (
                    <div className="rounded-2xl bg-peach p-4 text-[15px] leading-snug">
                      <p className="font-semibold">No encontré esa ciudad en Estados Unidos.</p>
                      <p className="mt-1 text-muted-foreground">
                        Revisa cómo está escrita, por ejemplo “Miami, FL”.
                      </p>
                      <button
                        type="button"
                        onClick={() => setUnlisted(true)}
                        className="mt-2 h-10 rounded-full border border-accent/40 bg-card px-4 text-[14px] font-bold text-accent"
                      >
                        Usar tal como la escribí
                      </button>
                    </div>
                  ) : null}
                  {unlisted ? (
                    <p className="rounded-2xl bg-muted p-3 text-[14px] text-muted-foreground">
                      Listo, usaré “{value.trim()}” sin verificar.
                    </p>
                  ) : null}
                  {placesFailed ? (
                    <p className="rounded-2xl bg-muted p-3 text-[14px] text-muted-foreground">
                      No pude verificar la ciudad ahora (sin conexión). Escríbela y sigue; podrás
                      cambiarla después.
                    </p>
                  ) : null}
                  {!places && !placesFailed && value.trim().length >= 2 ? (
                    <p className="px-1 text-[14px] text-muted-foreground">Buscando…</p>
                  ) : null}
                </>
              )}
              {matched ? (
                <div className="relative overflow-hidden rounded-[1.5rem] bg-brand-soft p-5">
                  <div className="max-w-[55%]">
                    <p className="text-[22px] font-extrabold leading-tight">
                      Perfecto, ya casi está.
                    </p>
                    <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
                      Marcelo dejará todo listo para tu negocio.
                    </p>
                  </div>
                  <img
                    src={character}
                    alt=""
                    aria-hidden
                    className="absolute -bottom-2 right-1 size-[130px] object-contain"
                  />
                  <span className="absolute bottom-5 right-4 flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-card)]">
                    <MapPin className="size-5" />
                  </span>
                  <div className="h-14" aria-hidden />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 -mx-5 mt-6 bg-background/95 px-5 pb-1 pt-3 backdrop-blur">
          <PrimaryButton type="submit" disabled={!value.trim() || !cityOk}>
            {last ? "Entrar a Marcelo" : "Continuar"} <ArrowRight className="size-5" />
          </PrimaryButton>
          {step === 0 ? (
            <p className="mt-3 text-center text-[14px] text-muted-foreground">
              Lo puedes cambiar después
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="mx-auto mt-2 flex h-11 items-center px-6 text-[16px] font-semibold text-muted-foreground"
            >
              Atrás
            </button>
          )}
        </div>
      </form>
    </Frame>
  );
}

/** Two speech bubbles with Marcelo's mark: "we are going to talk". */
function ChatIllustration() {
  return (
    <div className="relative mx-auto mt-2 h-[120px] w-[190px] shrink-0" aria-hidden>
      <div className="absolute left-6 top-2 flex size-[92px] items-center justify-center rounded-[1.75rem] rounded-bl-md bg-brand-soft shadow-[var(--shadow-card)]">
        <img src={mark} alt="" className="size-14 object-contain" />
      </div>
      <div className="absolute bottom-1 right-2 flex h-[64px] w-[84px] items-center justify-center gap-1.5 rounded-[1.5rem] rounded-br-md bg-brand-soft/80">
        <span className="size-2.5 rounded-full bg-sky/70" />
        <span className="size-2.5 rounded-full bg-sky/70" />
        <span className="size-2.5 rounded-full bg-sky/70" />
      </div>
      <span className="absolute left-0 top-6 h-1.5 w-5 -rotate-[20deg] rounded-full bg-sky" />
      <span className="absolute left-3 top-0 h-1.5 w-5 rotate-[55deg] rounded-full bg-sky" />
    </div>
  );
}
