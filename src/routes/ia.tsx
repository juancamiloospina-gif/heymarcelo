import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Ban,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Infinity as InfinityIcon,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BackButton, Button, Card, Screen, Sheet } from "@/components/marcelo/kit";
import { IconChip } from "@/components/marcelo/visual";
import { providers, saveOwnAI, useAIStatus, type Provider } from "@/lib/ai/config";
import { friendlyError, listModels } from "@/lib/ai/providers";
import { cn } from "@/lib/utils";
import character from "@/assets/marcelo-character.png";

export const Route = createFileRoute("/ia")({
  head: () => ({
    meta: [
      { title: "Tu IA — Marcelo" },
      {
        name: "description",
        content:
          "Conecta tu propia IA (Claude, ChatGPT, Gemini) para usar el asistente sin límite.",
      },
    ],
  }),
  component: TuIA,
});

const canDo = [
  "Agendar, mover y cancelar trabajos",
  "Agregar clientes y actualizar sus datos",
  "Anotar gastos, cobros y pendientes",
  "Cambiar el precio de tus servicios",
  "Escribir mensajes en inglés para tus clientes",
  "Contestar preguntas sobre tu agenda y tu dinero",
];

const cannotDo = [
  "Cambiar la app, sus pantallas o cómo funciona",
  "Tocar tus conexiones de WhatsApp o SMS",
  "Cambiar tu configuración o esta clave",
  "Borrar todos tus datos",
  "Hacer cambios sin que tú confirmes",
];

const renewDay = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toLocaleDateString("es-US", { day: "numeric", month: "long" });
};

const providerTone: Record<Provider, string> = {
  anthropic: "bg-peach text-foreground",
  openai: "bg-muted text-foreground",
  gemini: "bg-brand-soft text-sky",
  openrouter: "bg-brand-soft text-foreground",
};

// Stand-ins for the providers' logos: a distinct mark each, so the four cards are easy to tell apart.
const providerMark: Record<Provider, string> = {
  anthropic: "A",
  openai: "G",
  gemini: "✦",
  openrouter: "⇄",
};

function TuIA() {
  const { own, percentUsed, left } = useAIStatus();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState("");
  const [perms, setPerms] = useState(false);

  const check = async () => {
    setChecking(true);
    setModels(null);
    try {
      const list = await listModels(provider, key.trim());
      if (list.length === 0) throw new Error("no models");
      setModels(list);
      setModel(list[0] ?? "");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setChecking(false);
    }
  };

  const save = () => {
    saveOwnAI({ provider, apiKey: key.trim(), model });
    setKey("");
    setModels(null);
    toast.success(`${providers[provider].name} conectado. El asistente ya no tiene límite.`);
  };

  return (
    <Screen>
      <BackButton onClick={() => navigate({ to: "/configuracion" })} label="Configuración" />
      <div className="mb-5 flex items-start justify-between gap-2">
        <div className="min-w-0 pt-2">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Tu propia IA</h1>
          <p className="mt-1 text-[16px] leading-snug text-muted-foreground">
            Opcional. Conecta tu cuenta para usar tu propio proveedor.
          </p>
        </div>
        <span className="flex size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft">
          <img src={character} alt="" aria-hidden className="size-[96px] object-contain" />
        </span>
      </div>

      {own ? (
        <Card className="rounded-[1.25rem] border-success/30 bg-success/5">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
              <InfinityIcon className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-extrabold">
                Usando tu IA: {providers[own.provider].name}
              </p>
              <p className="mt-0.5 truncate text-[14px] text-muted-foreground">
                Modelo {own.model}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Sin límite. Lo que uses se cobra en tu cuenta de {providers[own.provider].company},
                no en Marcelo.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-destructive"
            onClick={() => {
              saveOwnAI(null);
              toast("Desconectado. Vuelves al asistente incluido.");
            }}
          >
            Desconectar mi IA
          </Button>
        </Card>
      ) : (
        <Card className="rounded-[1.25rem] p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-peach text-accent">
              <Sparkles className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-extrabold">Incluido con Marcelo</p>
              <p className="text-[15px] text-muted-foreground">
                {left} {left === 1 ? "conversación" : "conversaciones"} este mes
              </p>
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                percentUsed >= 100
                  ? "bg-destructive"
                  : percentUsed >= 80
                    ? "bg-warning"
                    : "bg-accent",
              )}
              style={{ width: `${100 - percentUsed}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {percentUsed >= 100
              ? `Se acabaron este mes. Vuelven el ${renewDay()}, o conecta tu IA abajo.`
              : `Se renuevan el ${renewDay()}.`}
          </p>
          <button
            onClick={() => navigate({ to: "/configuracion" })}
            className="mt-1 h-10 text-[15px] font-bold text-sky"
          >
            Seguir con Marcelo
          </button>
        </Card>
      )}

      {!own ? (
        <>
          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em]">
            Conecta tu proveedor
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(providers) as Provider[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setProvider(p);
                  setModels(null);
                }}
                role="radio"
                aria-checked={provider === p}
                className={cn(
                  "flex min-w-0 flex-col gap-2 rounded-[1.25rem] border bg-card p-3 text-left shadow-[var(--shadow-card)] transition-colors",
                  provider === p ? "border-accent bg-peach" : "border-transparent",
                )}
              >
                <span className="flex items-start justify-between">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold",
                      providerTone[p],
                    )}
                  >
                    {providerMark[p]}
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border-2",
                      provider === p
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {provider === p ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-extrabold">
                    {providers[p].name}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {providers[p].company}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="mb-2 mt-6 flex items-center justify-between">
            <h2 className="text-[18px] font-extrabold">Clave API de {providers[provider].name}</h2>
            <a
              href={providers[provider].keyUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[13px] font-bold text-sky"
            >
              ¿Dónde la saco? <ExternalLink className="size-3" />
            </a>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Clave de ${providers[provider].name}`}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setModels(null);
              }}
              placeholder={providers[provider].keyHint}
              className="h-14 w-full rounded-2xl border border-input bg-card pl-12 pr-12 font-mono text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
            <button
              type="button"
              aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground"
            >
              {showKey ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <p className="mt-2 flex items-start gap-2 text-[14px] leading-snug text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            La clave se guarda solo en este teléfono y va directo a {providers[provider].company}.
          </p>

          {models ? (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
                  Modelo
                </span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[15px] outline-none focus:border-accent"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-success">
                <Check className="size-4" /> La conexión funciona.
              </p>
              <Button
                className="h-14 w-full rounded-full text-[17px]"
                onClick={save}
                disabled={!model}
              >
                Usar {providers[provider].name}
              </Button>
            </div>
          ) : (
            <Button
              className="mt-4 h-14 w-full rounded-full text-[17px]"
              onClick={check}
              disabled={key.trim().length < 12 || checking}
            >
              {checking ? <Loader2 className="size-5 animate-spin" /> : null}
              {checking ? "Probando…" : "Probar conexión"}
            </Button>
          )}

          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Ojo: ChatGPT Plus, Claude Pro o Gemini Advanced no incluyen clave. La clave se saca en
            la página del proveedor y se paga por uso, con tu tarjeta.
          </p>
        </>
      ) : null}

      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-soft p-4">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sky" />
        <p className="text-[15px] leading-snug">
          Cuando conectes tu IA, Marcelo seguirá pidiendo confirmación antes de cambiar algo.
        </p>
      </div>

      <Card
        onClick={() => setPerms(true)}
        className="mt-3 flex items-center gap-3 rounded-[1.25rem] p-3.5"
      >
        <ShieldCheck className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.6} />
        <span className="flex-1 text-[16px] font-semibold">Ver permisos de mi IA</span>
        <ChevronRight className="size-5 text-muted-foreground/60" />
      </Card>

      <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Tu clave se guarda solo en este teléfono y va directo a tu proveedor: Marcelo nunca la ve ni
        la guarda. Lo que le pides a tu IA y un resumen de tus datos se envían a ese proveedor para
        responderte.
      </p>

      {perms ? (
        <Sheet
          title="Permisos de tu IA"
          icon={<ShieldCheck className="size-5 text-sky" />}
          onClose={() => setPerms(false)}
        >
          <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.1em]">Qué puede hacer</p>
          <div className="space-y-2.5">
            {canDo.map((t) => (
              <p key={t} className="flex items-start gap-2.5 text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-success" /> {t}
              </p>
            ))}
            <p className="border-t pt-3 text-[13px] text-muted-foreground">
              Siempre te pregunta antes de cambiar algo.
            </p>
          </div>
          <p className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-[0.1em]">
            Lo que nunca puede hacer
          </p>
          <div className="space-y-2.5">
            {cannotDo.map((t) => (
              <p key={t} className="flex items-start gap-2.5 text-[15px]">
                <Ban className="mt-0.5 size-4 shrink-0 text-destructive" /> {t}
              </p>
            ))}
          </div>
        </Sheet>
      ) : null}
    </Screen>
  );
}
