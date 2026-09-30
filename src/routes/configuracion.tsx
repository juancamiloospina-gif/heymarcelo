import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BellRing,
  Bot,
  ChevronRight,
  Download,
  Plug,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Type,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  BackButton,
  Badge,
  Button,
  Card,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
} from "@/components/marcelo/kit";
import { ClientAvatar } from "@/components/marcelo/visual";
import { QuoteLinkCard } from "@/components/marcelo/quote-link";
import { useMarcelo } from "@/lib/marcelo-store";
import { useAIStatus, providers } from "@/lib/ai/config";
import { todayISO, type AutoMessageKind } from "@/lib/marcelo-data";
import { DEMO_MODE } from "@/lib/flags";
import { cn } from "@/lib/utils";
import mark from "@/assets/marcelo-mark.png";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Marcelo" },
      {
        name: "description",
        content: "Tu perfil, el asistente, mensajes automáticos y tus datos.",
      },
    ],
  }),
  component: Configuracion,
});

const autoLabels: Record<AutoMessageKind, string> = {
  confirm: "Confirmación del trabajo",
  reminder: "Recordatorio 24 h antes",
  onTheWay: "Voy en camino",
};

const renewDay = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toLocaleDateString("es-US", { day: "numeric", month: "long" });
};

function Configuracion() {
  const navigate = useNavigate();
  const { state, setProfile, setSettings, reset } = useMarcelo();
  const ai = useAIStatus();
  const [form, setForm] = useState(state.profile);
  const [editing, setEditing] = useState(false);
  const [danger, setDanger] = useState<0 | 1 | 2>(0);
  const { settings } = state;

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcelo-copia-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Copia descargada");
  };

  return (
    <Screen>
      <BackButton onClick={() => navigate({ to: "/" })} label="Inicio" />
      <PageTitle title="Configuración" />

      <Card className="mb-2">
        {editing ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setProfile({
                name: form.name.trim(),
                trade: form.trade.trim(),
                city: form.city.trim(),
              });
              setEditing(false);
              toast.success("Perfil guardado");
            }}
          >
            <Field
              label="Tu nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              label="¿A qué te dedicas?"
              value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
            />
            <Field
              label="Ciudad"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!form.name.trim()}>
                Guardar
              </Button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => {
              setForm(state.profile);
              setEditing(true);
            }}
            className="flex w-full items-center gap-4 text-left"
          >
            <ClientAvatar name={state.profile.name || "?"} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-bold">{state.profile.name || "Tu perfil"}</p>
              <p className="truncate text-[15px] text-muted-foreground">
                {[state.profile.trade, state.profile.city].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="text-[15px] font-semibold text-accent">Editar</span>
          </button>
        )}
      </Card>

      <SectionTitle>Asistente</SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 size-5 text-accent" />
          <div className="flex-1">
            {ai.own ? (
              <>
                <p className="text-[16px] font-semibold">Sin límite de conversaciones</p>
                <p className="text-[14px] text-muted-foreground">
                  Usando tu cuenta de {providers[ai.own.provider].name}.
                </p>
              </>
            ) : (
              <>
                <p className="text-[16px] font-semibold">
                  Te quedan {ai.left} {ai.left === 1 ? "conversación" : "conversaciones"} este mes
                </p>
                <p className="text-[14px] text-muted-foreground">
                  Incluye voz y traducciones. Se renueva el {renewDay()}.
                </p>
              </>
            )}
          </div>
        </div>
        {!ai.own ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                ai.percentUsed >= 80 ? "bg-warning" : "bg-accent",
              )}
              style={{ width: `${100 - ai.percentUsed}%` }}
            />
          </div>
        ) : null}
        <p className="text-[14px] text-muted-foreground">
          Las respuestas automáticas a tus clientes nunca gastan conversaciones.
        </p>
      </Card>

      <Card className="mt-2 divide-y divide-border p-0">
        <LinkRow
          icon={Tags}
          label="Servicios, precios y horario"
          onClick={() => navigate({ to: "/servicios" })}
        />
        <LinkRow icon={Users} label="Clientes" onClick={() => navigate({ to: "/clientes" })} />
        <LinkRow
          icon={Plug}
          label="WhatsApp y SMS"
          onClick={() => navigate({ to: "/conexiones" })}
          badge={DEMO_MODE ? "Demo" : undefined}
        />
        <LinkRow
          icon={SlidersHorizontal}
          label="Avanzado"
          hint="Usar tu propia cuenta de IA"
          onClick={() => navigate({ to: "/ia" })}
        />
      </Card>

      <SectionTitle>Mensajes a clientes</SectionTitle>
      <Card className="divide-y divide-border p-0">
        <ToggleRow
          icon={Bot}
          label="Marcelo contesta solo"
          hint="Cotiza con tus precios y agenda cuando aceptan"
          on={settings.autoReply}
          onChange={(v) => setSettings({ autoReply: v })}
        />
        {(Object.keys(autoLabels) as AutoMessageKind[]).map((k) => (
          <ToggleRow
            key={k}
            icon={BellRing}
            label={autoLabels[k]}
            hint={
              settings.autoMessages[k] === "auto"
                ? "Se envía solo"
                : "Te lo muestro antes de enviar"
            }
            on={settings.autoMessages[k] === "auto"}
            onChange={(v) =>
              setSettings({ autoMessages: { ...settings.autoMessages, [k]: v ? "auto" : "ask" } })
            }
          />
        ))}
      </Card>

      <SectionTitle>Cobros</SectionTitle>
      <Card>
        <Field
          label="Cómo te pagan (sale en tus facturas)"
          placeholder="Zelle (626) 555-0100 o efectivo"
          value={settings.paymentInstructions}
          onChange={(e) => setSettings({ paymentInstructions: e.target.value })}
        />
        <p className="mt-2 flex items-center gap-1.5 text-[14px] text-muted-foreground">
          <Wallet className="size-4" /> Se muestra en inglés en la factura.
        </p>
      </Card>

      <SectionTitle>Consigue clientes</SectionTitle>
      <QuoteLinkCard />

      <SectionTitle>Pantalla</SectionTitle>
      <Card className="p-0">
        <ToggleRow
          icon={Type}
          label="Texto grande"
          hint="Todo se ve más grande"
          on={settings.largeText}
          onChange={(v) => setSettings({ largeText: v })}
        />
      </Card>

      <SectionTitle>Privacidad</SectionTitle>
      <Card className="space-y-2 text-[15px] leading-relaxed text-muted-foreground">
        <p className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
          Tus clientes, cobros y gastos se guardan solo en este teléfono.
        </p>
        <p>
          Cuando hablas con Marcelo, lo que dices y un resumen de tus datos se envían para preparar
          la respuesta.
        </p>
        <p>
          Si borras los datos del navegador o cambias de teléfono, se pierden. Descarga una copia de
          vez en cuando.
        </p>
      </Card>

      <SectionTitle>Zona de riesgo</SectionTitle>
      <Card className="space-y-3 border-destructive/25">
        <Button variant="secondary" className="w-full" onClick={downloadBackup}>
          <Download className="size-5" /> Exportar mis datos
        </Button>
        {danger === 0 ? (
          <Button variant="danger" className="w-full" onClick={() => setDanger(1)}>
            <RotateCcw className="size-5" /> Empezar de nuevo
          </Button>
        ) : (
          <div className="space-y-3 rounded-2xl bg-destructive/5 p-3">
            <p className="flex items-start gap-2 text-[15px] font-semibold text-destructive">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              {danger === 1
                ? "Se borran todos tus clientes, trabajos y dinero. ¿Seguro?"
                : "Última confirmación: esto no se puede deshacer."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setDanger(0)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (danger === 1) return setDanger(2);
                  reset();
                  setDanger(0);
                  toast.success("Marcelo empezó de nuevo");
                  navigate({ to: "/" });
                }}
              >
                {danger === 1 ? "Sí, borrar" : "Borrar todo"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-6 flex flex-col items-center gap-2 text-center text-[13px] text-muted-foreground">
        <img src={mark} alt="" className="h-6 w-auto opacity-80" />
        Versión 2.0.0
      </p>
    </Screen>
  );
}

function LinkRow({
  icon: Icon,
  label,
  hint,
  badge,
  onClick,
}: {
  icon: typeof Tags;
  label: string;
  hint?: string;
  badge?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
    >
      <Icon className="size-5 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium">{label}</span>
        {hint ? <span className="block text-[14px] text-muted-foreground">{hint}</span> : null}
      </span>
      {badge ? <Badge tone="warning">{badge}</Badge> : null}
      <ChevronRight className="size-5 text-muted-foreground/50" />
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  hint,
  on,
  onChange,
}: {
  icon: typeof Tags;
  label: string;
  hint?: ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium">{label}</span>
        {hint ? <span className="block text-[14px] text-muted-foreground">{hint}</span> : null}
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-muted-foreground/25",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-6 rounded-full bg-card shadow transition-all",
            on ? "left-7" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
