import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarCheck,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  BackButton,
  Button,
  Card,
  Field,
  PageTitle,
  Screen,
  Sheet,
} from "@/components/marcelo/kit";
import { channelVisual } from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
import type { Channel } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";
import character from "@/assets/marcelo-character.png";

export const Route = createFileRoute("/conexiones")({
  head: () => ({
    meta: [
      { title: "Conexiones — Marcelo" },
      {
        name: "description",
        content: "Conecta WhatsApp Business o SMS para que Marcelo conteste a tus clientes.",
      },
    ],
  }),
  component: Conexiones,
});

const copy: Record<Channel, { title: string; body: string; cta: string }> = {
  whatsapp: {
    title: "WhatsApp Business",
    body: "Tus clientes te escriben a tu número de negocio.",
    cta: "Conectar WhatsApp",
  },
  sms: {
    title: "Mensajes de texto (SMS)",
    body: "Responde desde tu número.",
    cta: "Conectar SMS",
  },
};

const digits10 = (n?: string) => (n ?? "").replace(/\D/g, "").slice(-10);

function Conexiones() {
  const { state, setConnection } = useMarcelo();
  const navigate = useNavigate();

  return (
    <Screen>
      <BackButton onClick={() => navigate({ to: "/configuracion" })} label="Configuración" />
      <PageTitle title="Conexiones" subtitle="Elige dónde quieres hablar con tus clientes." />

      <div className="mb-6 flex items-center gap-2 overflow-hidden rounded-[1.25rem] bg-brand-soft pr-3">
        <img
          src={character}
          alt=""
          aria-hidden
          className="-mb-2 mt-1 size-[88px] shrink-0 object-contain"
        />
        <p className="my-3 flex-1 rounded-2xl bg-card/80 px-4 py-3 text-[15px] leading-snug">
          <b>Tú eliges qué canales conectar.</b>
          <br />
          <span className="text-muted-foreground">Puedes cambiarlos cuando quieras.</span>
        </p>
      </div>

      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em]">Tus canales</h2>
      <div className="space-y-3">
        {(["whatsapp", "sms"] as const).map((ch) => (
          <ChannelCard
            key={ch}
            channel={ch}
            connected={state.connections[ch].connected}
            number={state.connections[ch].number}
            onConnect={(number) => {
              setConnection(ch, { connected: true, number });
              toast.success(`${copy[ch].title} conectado`);
            }}
            onDisconnect={() => {
              setConnection(ch, { connected: false, number: undefined });
              toast(`${copy[ch].title} desconectado`);
            }}
          />
        ))}
      </div>

      <Card
        onClick={() => navigate({ to: "/bandeja", search: { simular: 1 } })}
        className="mt-3 flex items-center gap-3 rounded-[1.25rem] border-sky/15 bg-brand-soft p-3.5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-sky">
          <MessagesSquare className="size-6" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">Prueba cómo responde Marcelo</span>
          <span className="block text-[14px] text-muted-foreground">
            Mándate un mensaje de prueba.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-sky" />
      </Card>

      <Card className="mt-3 space-y-3 rounded-[1.25rem] text-[14px] leading-relaxed">
        <p className="text-[16px] font-bold">Qué pasa hoy</p>
        <p className="text-muted-foreground">
          <b className="text-foreground">Funciona ya:</b> los botones “WhatsApp” del trabajo y
          “Abrir en WhatsApp” de los mensajes preparados abren tu WhatsApp con el mensaje escrito;
          tú tocas enviar. Lo mismo con el texto SMS desde Mensajes.
        </p>
        <p className="text-muted-foreground">
          <b className="text-foreground">Aún no funciona:</b> que Marcelo envíe y reciba por sí
          solo. Para eso falta conectar la API oficial de WhatsApp Business y un proveedor de SMS
          (detalle en <code>docs/WHATSAPP_SMS.md</code>). Hasta entonces, conectar tu número solo lo
          deja guardado.
        </p>
        <TestLinks
          whatsapp={state.connections.whatsapp.number}
          sms={state.connections.sms.number}
        />
      </Card>

      <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em]">Cómo funciona</h2>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1">
        <Step n={1} label="El cliente te escribe">
          <MessageSquareText className="size-7 text-accent" strokeWidth={1.6} />
        </Step>
        <Arrow />
        <Step n={2} label="Marcelo prepara la respuesta">
          <img src={character} alt="" aria-hidden className="size-14 object-contain" />
        </Step>
        <Arrow />
        <Step n={3} label="Tú tienes el control">
          <CalendarCheck className="size-7 text-accent" strokeWidth={1.6} />
        </Step>
      </div>
      <Button
        variant="secondary"
        className="mt-5 w-full rounded-full border-2 border-sky text-sky"
        onClick={() => navigate({ to: "/bandeja" })}
      >
        Ir a Mensajes
      </Button>
    </Screen>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="relative flex size-[72px] items-center justify-center rounded-full bg-peach">
        <span className="absolute -left-1 -top-1 flex size-6 items-center justify-center rounded-full bg-accent/20 text-[13px] font-bold text-accent">
          {n}
        </span>
        {children}
      </span>
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
    </div>
  );
}

const Arrow = () => <span className="mt-6 text-[22px] text-muted-foreground/50">→</span>;

/** Real tests that need no server: they open WhatsApp / Messages on this phone with a test text. */
function TestLinks({ whatsapp, sms }: { whatsapp?: string | undefined; sms?: string | undefined }) {
  const text = encodeURIComponent("Prueba de Marcelo: si ves este mensaje, el enlace funciona.");
  return (
    <div className="grid gap-2 border-t pt-3">
      <p className="text-[13px] font-semibold">Pruébalo ahora (te escribes a ti mismo)</p>
      {digits10(whatsapp).length === 10 ? (
        <a
          href={`https://wa.me/1${digits10(whatsapp)}?text=${text}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold"
        >
          <ExternalLink className="size-4" /> Abrir WhatsApp con mi número
        </a>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Conecta tu número de WhatsApp para probar el enlace.
        </p>
      )}
      {digits10(sms).length === 10 ? (
        <a
          href={`sms:+1${digits10(sms)}?&body=${text}`}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold"
        >
          <ExternalLink className="size-4" /> Abrir SMS con mi número
        </a>
      ) : null}
      <p className="text-[12px] text-muted-foreground">
        Resultado esperado: se abre la app con el texto escrito y tu número como destinatario. Si
        WhatsApp dice “número no válido”, revisa que sea de 10 dígitos de EE. UU.
      </p>
    </div>
  );
}

function ChannelCard({
  channel,
  connected,
  number,
  onConnect,
  onDisconnect,
}: {
  channel: Channel;
  connected: boolean;
  number?: string | undefined;
  onConnect: (number: string) => void;
  onDisconnect: () => void;
}) {
  const { icon: Icon, chip } = channelVisual[channel];
  const [step, setStep] = useState<"idle" | "number" | "code" | "loading">("idle");
  const [manage, setManage] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  return (
    <Card className="rounded-[1.25rem] p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", chip)}
        >
          <Icon className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-extrabold leading-tight">{copy[channel].title}</p>
          {connected ? (
            <>
              <p className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold text-success">
                <span className="size-2.5 rounded-full bg-success" /> Conectado
              </p>
              <p className="text-[15px] text-muted-foreground">{number}</p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-[15px] text-muted-foreground">{copy[channel].body}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted-foreground">
                <span className="size-2.5 rounded-full bg-muted-foreground/40" /> Aún no conectado
              </p>
            </>
          )}
        </div>
        {connected ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
            <Check className="size-5" strokeWidth={2.6} />
          </span>
        ) : null}
      </div>

      <div className="mt-3 border-t pt-3">
        {connected ? (
          <button
            onClick={() => setManage(true)}
            className="h-12 w-full rounded-full border-2 border-sky text-[16px] font-bold text-sky"
          >
            Administrar
          </button>
        ) : step === "idle" ? (
          <Button className="w-full rounded-full" onClick={() => setStep("number")}>
            {copy[channel].cta}
          </Button>
        ) : step === "number" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (phone.replace(/\D/g, "").length >= 10) setStep("code");
            }}
          >
            <Field
              label="Tu número de negocio"
              autoFocus
              inputMode="tel"
              placeholder="(626) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("idle")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={phone.replace(/\D/g, "").length < 10}>
                Enviar código
              </Button>
            </div>
          </form>
        ) : step === "code" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setStep("loading");
              window.setTimeout(() => {
                const d = phone.replace(/\D/g, "").slice(-10);
                onConnect(`(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`);
                setStep("idle");
                setCode("");
              }, 900);
            }}
          >
            <Field
              label="Código de 6 dígitos"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("number")}>
                Atrás
              </Button>
              <Button type="submit" disabled={code.length < 6}>
                Confirmar
              </Button>
            </div>
          </form>
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-[14px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Conectando…
          </p>
        )}
      </div>

      {manage ? (
        <Sheet
          title={copy[channel].title}
          icon={<MessageCircle className="size-5 text-success" />}
          onClose={() => setManage(false)}
        >
          <p className="text-[15px] text-muted-foreground">Número conectado</p>
          <p className="mb-4 text-[20px] font-extrabold">{number}</p>
          <TestLinks
            whatsapp={channel === "whatsapp" ? number : undefined}
            sms={channel === "sms" ? number : undefined}
          />
          <Button
            variant="danger"
            className="mt-4 w-full"
            onClick={() => {
              setManage(false);
              onDisconnect();
            }}
          >
            Desconectar
          </Button>
        </Sheet>
      ) : null}
    </Card>
  );
}
