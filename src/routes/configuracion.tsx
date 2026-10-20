import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Globe,
  GraduationCap,
  Pencil,
  Plug,
  RotateCcw,
  Share2,
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
  Screen,
  SectionTitle,
  Sheet,
} from "@/components/marcelo/kit";
import { ClientAvatar } from "@/components/marcelo/visual";
import { UserPhoto } from "@/components/marcelo/mascot";
import { QuoteLinkCard } from "@/components/marcelo/quote-link";
import { useMarcelo } from "@/lib/marcelo-store";
import { useAIStatus, providers } from "@/lib/ai/config";
import { todayISO, type AutoMessageKind } from "@/lib/marcelo-data";
import { DEMO_MODE } from "@/lib/flags";
import { cn } from "@/lib/utils";
import mark from "@/assets/marcelo-mark.png";
import character from "@/assets/marcelo-character.png";
import { buildPublicProfile, shareUrl } from "@/lib/public-profile";

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
  survey: "Encuesta de calificación al terminar",
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
  const [danger, setDanger] = useState<0 | 1 | 2>(0);
  const [sheet, setSheet] = useState<"qr" | "cobros" | "pantalla" | "privacidad" | null>(null);
  const { settings } = state;

  // The shareable link exists only once the page is published (same rule as the QR and flyer).
  const profile = useMemo(() => buildPublicProfile(state), [state]);
  const link = shareUrl(profile, "qr");
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!link) return setQr("");
    void QRCode.toDataURL(link, {
      margin: 1,
      width: 240,
      color: { dark: "#16263a", light: "#ffffff" },
    }).then(setQr);
  }, [link]);

  const shareLink = async () => {
    if (!link) {
      toast("Primero publica tu página para tener un enlace.");
      return navigate({ to: "/mi-pagina" });
    }
    try {
      if (navigator.share) await navigator.share({ title: "Marcelo", url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.success("Enlace copiado");
      }
    } catch {
      // The user closed the share sheet: nothing to do.
    }
  };

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
      <BackButton onClick={() => navigate({ to: "/" })} label="Configuración" />

      <SectionTitle>Tu cuenta</SectionTitle>
      <Card className="mb-5 rounded-[1.25rem]">
        <div className="flex items-center gap-4">
          {state.profile.photoUrl ? (
            <UserPhoto className="size-12" />
          ) : (
            <ClientAvatar name={state.profile.name || "?"} size="md" className="size-12" />
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-[18px] font-extrabold leading-tight">
              {state.profile.name || "Tu perfil"}
            </p>
            <p className="truncate text-[15px] text-muted-foreground">
              {[state.profile.trade, state.profile.city].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/perfil" })}
            className="h-10 shrink-0 rounded-full border-2 border-sky px-3.5 text-[14px] font-bold text-sky"
          >
            Editar perfil
          </button>
        </div>
      </Card>

      <section className="relative overflow-hidden rounded-[1.5rem] bg-primary p-5 text-primary-foreground shadow-[var(--shadow-card)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10"
        />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-tight">
              Haz que te encuentren
            </h1>
            <p className="mt-2 max-w-[200px] text-[15px] leading-snug text-primary-foreground/85">
              Comparte tu página y recibe más cotizaciones.
            </p>
          </div>
          <img
            src={character}
            alt=""
            aria-hidden
            className="-mr-1 -mt-1 size-[120px] shrink-0 object-contain"
          />
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate({ to: "/mi-pagina" })}
            className="flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full bg-card px-2 text-[15px] font-bold text-foreground shadow-[var(--shadow-card)] transition-transform active:scale-95"
          >
            <Globe className="size-5 shrink-0 text-accent" /> Mi página
          </button>
          <button
            onClick={() => void shareLink()}
            className="flex h-12 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border-2 border-primary-foreground/60 px-1.5 text-[14px] font-bold transition-transform active:scale-95"
          >
            <Share2 className="size-4 shrink-0" /> Compartir enlace
          </button>
        </div>
      </section>

      {link ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-peach py-2 pl-2 pr-4 text-[15px] font-bold text-accent">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Check className="size-4" strokeWidth={3} />
          </span>
          Listo para compartir
        </p>
      ) : (
        <button
          onClick={() => navigate({ to: "/mi-pagina" })}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted py-2 pl-4 pr-3 text-[15px] font-semibold text-muted-foreground"
        >
          Publica tu página para compartirla <ChevronRight className="size-4" />
        </button>
      )}

      <SectionTitle
        action={
          <button
            onClick={() => navigate({ to: "/mi-pagina" })}
            className="flex h-10 items-center gap-1.5 text-[15px] font-semibold text-muted-foreground"
          >
            <Pencil className="size-4" /> Editar
          </button>
        }
      >
        Tu enlace
      </SectionTitle>
      <Card
        onClick={() => setSheet("qr")}
        className="flex items-center gap-4 rounded-[1.25rem] p-4"
      >
        <span className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-peach">
          {qr ? (
            <img src={qr} alt="Código QR de tu página" className="size-full object-cover" />
          ) : (
            <Globe className="size-9 text-accent" strokeWidth={1.5} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-extrabold">Pide tu cotización</span>
          <span className="block text-[14px] text-muted-foreground">
            {link ? "El cliente escanea y te escribe." : "Publica tu página para tener tu QR."}
          </span>
          <span className="mt-2 flex items-center gap-1 text-[15px] font-bold text-sky">
            Ver y descargar QR <ChevronRight className="size-4" />
          </span>
        </span>
      </Card>

      <SectionTitle>Lo esencial</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <EssentialCard
          icon={Wallet}
          tint="peach"
          title="Cobros"
          hint="Cómo te pagan"
          onClick={() => setSheet("cobros")}
        />
        <EssentialCard
          icon={Type}
          tint="brand"
          title="Pantalla"
          hint="Texto grande"
          onClick={() => setSheet("pantalla")}
        />
      </div>
      <Card
        onClick={() => {
          setProfile({ tourDone: false });
          navigate({ to: "/" });
        }}
        className="mt-2 flex items-center gap-3 rounded-[1.25rem] p-3.5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-peach text-accent">
          <GraduationCap className="size-6" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Ver el tutorial</span>
          <span className="block text-[14px] leading-snug text-muted-foreground">
            Un recorrido corto por cada parte de Marcelo
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
      </Card>
      <Card
        onClick={() => setSheet("privacidad")}
        className="mt-2 flex items-center gap-3 rounded-[1.25rem] p-3.5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
          <ShieldCheck className="size-6" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Datos y privacidad</span>
          <span className="block text-[14px] leading-snug text-muted-foreground">
            Tu información se guarda en este teléfono
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
      </Card>

      <SectionTitle>Asistente</SectionTitle>
      <Card className="space-y-3 rounded-[1.25rem] border-sky/15 bg-brand-soft">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-sky" />
          <div className="flex-1">
            {ai.own ? (
              <>
                <p className="text-[17px] font-bold">Sin límite de conversaciones</p>
                <p className="text-[14px] text-muted-foreground">
                  Usando tu cuenta de {providers[ai.own.provider].name}.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-sky">Este mes</p>
                <p className="text-[19px] font-extrabold leading-snug">
                  Te quedan {ai.left} {ai.left === 1 ? "conversación" : "conversaciones"}
                </p>
              </>
            )}
          </div>
        </div>
        {!ai.own ? (
          <>
            <div className="h-2.5 overflow-hidden rounded-full bg-card">
              <div
                className={cn(
                  "h-full rounded-full",
                  ai.percentUsed >= 80 ? "bg-warning" : "bg-accent",
                )}
                style={{ width: `${100 - ai.percentUsed}%` }}
              />
            </div>
            <p className="text-[14px] text-muted-foreground">
              Incluye voz y traducciones. Se renueva el {renewDay()}.
            </p>
          </>
        ) : null}
        <p className="text-[14px] text-muted-foreground">
          Las respuestas automáticas a tus clientes nunca gastan conversaciones.
        </p>
      </Card>

      <Card className="mt-2 divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
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
      <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
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

      <p className="mt-6 flex flex-col items-center gap-2 text-center text-[13px] text-muted-foreground">
        <img src={mark} alt="" className="h-6 w-auto opacity-80" />
        Versión 2.0.0
      </p>

      {sheet === "qr" ? (
        <Sheet title="Tu QR y tu volante" onClose={() => setSheet(null)}>
          <QuoteLinkCard />
        </Sheet>
      ) : null}

      {sheet === "cobros" ? (
        <Sheet
          title="Cobros"
          icon={<Wallet className="size-5 text-accent" />}
          onClose={() => setSheet(null)}
        >
          <Field
            label="Cómo te pagan (sale en tus facturas)"
            placeholder="Zelle (626) 555-0100 o efectivo"
            value={settings.paymentInstructions}
            onChange={(e) => setSettings({ paymentInstructions: e.target.value })}
          />
          <p className="mt-2 flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <Wallet className="size-4" /> Se muestra en inglés en la factura.
          </p>
          <Button className="mt-4 w-full" onClick={() => setSheet(null)}>
            Listo
          </Button>
        </Sheet>
      ) : null}

      {sheet === "pantalla" ? (
        <Sheet
          title="Pantalla"
          icon={<Type className="size-5 text-sky" />}
          onClose={() => setSheet(null)}
        >
          <Card className="p-0">
            <ToggleRow
              icon={Type}
              label="Texto grande"
              hint="Todo se ve más grande"
              on={settings.largeText}
              onChange={(v) => setSettings({ largeText: v })}
            />
          </Card>
        </Sheet>
      ) : null}

      {sheet === "privacidad" ? (
        <Sheet
          title="Datos y privacidad"
          icon={<ShieldCheck className="size-5 text-success" />}
          onClose={() => {
            setSheet(null);
            setDanger(0);
          }}
        >
          <div className="space-y-2 text-[15px] leading-relaxed text-muted-foreground">
            <p className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
              Tus clientes, cobros y gastos se guardan solo en este teléfono.
            </p>
            <p>
              Cuando hablas con Marcelo, lo que dices y un resumen de tus datos se envían para
              preparar la respuesta.
            </p>
            <p>
              Si borras los datos del navegador o cambias de teléfono, se pierden. Descarga una
              copia de vez en cuando.
            </p>
          </div>
          <p className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-[0.1em] text-destructive">
            Zona de riesgo
          </p>
          <div className="space-y-3 rounded-2xl border border-destructive/25 p-3">
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
                      setSheet(null);
                      toast.success("Marcelo empezó de nuevo");
                      navigate({ to: "/" });
                    }}
                  >
                    {danger === 1 ? "Sí, borrar" : "Borrar todo"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Sheet>
      ) : null}
    </Screen>
  );
}

function EssentialCard({
  icon: Icon,
  tint,
  title,
  hint,
  onClick,
}: {
  icon: typeof Tags;
  tint: "peach" | "brand";
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-[1.25rem] border p-2.5 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]",
        tint === "peach" ? "border-accent/15 bg-peach" : "border-sky/15 bg-brand-soft",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl bg-card",
          tint === "peach" ? "text-accent" : "text-sky",
        )}
      >
        <Icon className="size-6" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-tight">{title}</span>
        <span className="block text-[13px] leading-tight text-muted-foreground">{hint}</span>
      </span>
    </button>
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
