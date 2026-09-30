import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Infinity as InfinityIcon,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  PageTitle,
  Screen,
  SectionTitle,
  BackButton,
} from "@/components/marcelo/kit";
import { IconChip } from "@/components/marcelo/visual";
import { providers, saveOwnAI, useAIStatus, type Provider } from "@/lib/ai/config";
import { friendlyError, listModels } from "@/lib/ai/providers";
import { cn } from "@/lib/utils";

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

function TuIA() {
  const { own, percentUsed, left } = useAIStatus();
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState("");

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
      <BackButton />
      <PageTitle
        title="Avanzado: tu propia IA"
        subtitle="Opcional. Usa tu cuenta de IA y no tendrás límite."
      />

      {own ? (
        <Card className="border-success/30 bg-success/5">
          <div className="flex items-start gap-3">
            <IconChip icon={InfinityIcon} tone="success" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold">Usando tu IA: {providers[own.provider].name}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                Modelo {own.model}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
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
        <Card>
          <div className="flex items-start gap-3">
            <IconChip icon={Sparkles} tone="accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold">Conversaciones incluidas</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Viene con tu plan de Marcelo.
              </p>
            </div>
            <Badge tone={percentUsed >= 100 ? "danger" : percentUsed >= 80 ? "warning" : "neutral"}>
              Quedan {left}
            </Badge>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
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
          <p className="mt-2 text-[12px] text-muted-foreground">
            {percentUsed >= 100
              ? `Se acabaron este mes. Vuelven el ${renewDay()}, o conecta tu IA abajo.`
              : `Te quedan ${left} este mes. Se renuevan el ${renewDay()}.`}
          </p>
        </Card>
      )}

      {!own ? (
        <>
          <SectionTitle>Conectar mi IA</SectionTitle>
          <Card className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(providers) as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setProvider(p);
                    setModels(null);
                  }}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    provider === p ? "border-accent bg-accent/5" : "border-border",
                  )}
                >
                  <p className="text-[15px] font-bold">{providers[p].name}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {providers[p].company}
                  </p>
                </button>
              ))}
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-muted-foreground">
                Tu clave de {providers[provider].name}
                <a
                  href={providers[provider].keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-semibold text-accent"
                >
                  ¿Dónde la saco? <ExternalLink className="size-3" />
                </a>
              </span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setModels(null);
                  }}
                  placeholder={providers[provider].keyHint}
                  className="h-12 w-full rounded-2xl border border-input bg-card pl-11 pr-12 font-mono text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                />
                <button
                  type="button"
                  aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            {models ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                    Modelo
                  </span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[14px] outline-none focus:border-accent"
                  >
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                  <Check className="size-4" /> La clave funciona.
                </p>
                <Button className="w-full" onClick={save} disabled={!model}>
                  Usar {providers[provider].name}
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={check}
                disabled={key.trim().length < 12 || checking}
              >
                {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                {checking ? "Probando…" : "Probar clave"}
              </Button>
            )}

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Ojo: ChatGPT Plus, Claude Pro o Gemini Advanced no incluyen clave. La clave se saca en
              la página del proveedor y se paga por uso, con tu tarjeta.
            </p>
          </Card>
        </>
      ) : null}

      <SectionTitle>Qué puede hacer tu IA</SectionTitle>
      <Card className="space-y-2.5">
        {canDo.map((t) => (
          <p key={t} className="flex items-start gap-2.5 text-[14px]">
            <Check className="mt-0.5 size-4 shrink-0 text-success" /> {t}
          </p>
        ))}
        <p className="border-t pt-3 text-[12px] text-muted-foreground">
          Siempre te pregunta antes de cambiar algo.
        </p>
      </Card>

      <SectionTitle>Lo que nunca puede hacer</SectionTitle>
      <Card className="space-y-2.5">
        {cannotDo.map((t) => (
          <p key={t} className="flex items-start gap-2.5 text-[14px]">
            <Ban className="mt-0.5 size-4 shrink-0 text-destructive" /> {t}
          </p>
        ))}
      </Card>

      <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Tu clave se guarda solo en este teléfono y va directo a tu proveedor: Marcelo nunca la ve ni
        la guarda. Lo que le pides a tu IA y un resumen de tus datos se envían a ese proveedor para
        responderte.
      </p>
    </Screen>
  );
}
