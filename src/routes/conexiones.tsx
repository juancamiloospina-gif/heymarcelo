import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
  BackButton,
} from "@/components/marcelo/kit";
import { channelVisual } from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
import { DEMO_MODE } from "@/lib/flags";
import type { Channel } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

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

const copy: Record<Channel, { title: string; body: string; steps: string[] }> = {
  whatsapp: {
    title: "WhatsApp Business",
    body: "Tus clientes te escriben a tu WhatsApp de negocio y Marcelo les contesta.",
    steps: [
      "Usa el número de tu WhatsApp Business",
      "Te llega un código para confirmar",
      "Listo: los chats aparecen en Mensajes",
    ],
  },
  sms: {
    title: "Mensajes de texto (SMS)",
    body: "Para clientes que te mandan texto normal. Marcelo responde desde tu número.",
    steps: [
      "Escribe el número al que te mandan texto",
      "Confirmas con un código",
      "Los textos aparecen en Mensajes",
    ],
  },
};

function Conexiones() {
  const { state, setConnection } = useMarcelo();
  const navigate = useNavigate();

  return (
    <Screen>
      <BackButton />
      <PageTitle title="Conexiones" subtitle="Dónde te escriben tus clientes." />

      {DEMO_MODE ? (
        <Card className="mb-5 flex items-start gap-3 border-warning/30 bg-warning/10">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
          <p className="text-[13px] leading-relaxed text-warning-foreground">
            <b>Modo demo.</b> Estas conexiones todavía no envían ni reciben mensajes reales. Sirven
            para probar cómo Marcelo contesta y agenda. Usa “Simular mensaje” en Mensajes.
          </p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {(["whatsapp", "sms"] as const).map((ch) => (
          <ChannelCard
            key={ch}
            channel={ch}
            connected={state.connections[ch].connected}
            number={state.connections[ch].number}
            onConnect={(number) => {
              setConnection(ch, { connected: true, number });
              toast.success(`${copy[ch].title} conectado (demo)`);
            }}
            onDisconnect={() => {
              setConnection(ch, { connected: false, number: undefined });
              toast(`${copy[ch].title} desconectado`);
            }}
          />
        ))}
      </div>

      <SectionTitle>Qué funciona hoy y qué falta</SectionTitle>
      <Card className="space-y-3 text-[14px] leading-relaxed">
        <p className="text-muted-foreground">
          <b className="text-foreground">Funciona de verdad:</b> los botones “WhatsApp” del trabajo
          y “Abrir en WhatsApp” de los mensajes preparados (abren tu WhatsApp con el mensaje
          escrito; tú tocas enviar) y el texto SMS desde Mensajes. No necesitan conexión.
        </p>
        <p className="text-muted-foreground">
          <b className="text-foreground">Todavía es demo:</b> “Conectar” (acepta cualquier código),
          recibir mensajes de clientes y que Marcelo envíe solo. Para eso falta un servidor con la
          API de WhatsApp Business (Meta Cloud API) y un proveedor de SMS (Twilio), con sus cuentas
          verificadas y plantillas aprobadas. Detalle en <code>docs/WHATSAPP_SMS.md</code>.
        </p>
        <TestLinks
          whatsapp={state.connections.whatsapp.number}
          sms={state.connections.sms.number}
        />
      </Card>

      <SectionTitle>Cómo funciona</SectionTitle>
      <Card className="space-y-3 text-[14px] leading-relaxed text-muted-foreground">
        <Step n={1}>Un cliente te escribe pidiendo un servicio.</Step>
        <Step n={2}>Marcelo le contesta en su idioma con tu precio y el primer espacio libre.</Step>
        <Step n={3}>Si acepta, el trabajo queda en tu agenda y el cliente en tu lista.</Step>
        <Step n={4}>Si pide descuento o algo raro, Marcelo te pasa el chat.</Step>
      </Card>

      <Button
        variant="secondary"
        className="mt-5 w-full"
        onClick={() => navigate({ to: "/bandeja" })}
      >
        Ir a Mensajes
      </Button>
    </Screen>
  );
}

/** Real tests that need no server: they open WhatsApp / Messages on this phone with a test text. */
function TestLinks({ whatsapp, sms }: { whatsapp?: string | undefined; sms?: string | undefined }) {
  const text = encodeURIComponent("Prueba de Marcelo: si ves este mensaje, el enlace funciona.");
  const d = (n?: string) => (n ?? "").replace(/\D/g, "").slice(-10);
  return (
    <div className="grid gap-2 border-t pt-3">
      <p className="text-[13px] font-semibold">Pruébalo ahora (te escribes a ti mismo)</p>
      {d(whatsapp).length === 10 ? (
        <a
          href={`https://wa.me/1${d(whatsapp)}?text=${text}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold"
        >
          <ExternalLink className="size-4" /> Abrir WhatsApp con mi número
        </a>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Conecta tu número de WhatsApp (arriba) para probar el enlace.
        </p>
      )}
      {d(sms).length === 10 ? (
        <a
          href={`sms:+1${d(sms)}?&body=${text}`}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-semibold"
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

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-[12px] font-bold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </p>
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
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  return (
    <Card className={cn("p-0", connected && "border-success/30")}>
      <div className="flex items-start gap-3 p-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", chip)}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-bold">{copy[channel].title}</p>
            {DEMO_MODE ? <Badge tone="warning">Demo</Badge> : null}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {connected ? (
              <span className="flex items-center gap-1 font-semibold text-success">
                <Check className="size-4" /> Conectado · {number}
              </span>
            ) : (
              copy[channel].body
            )}
          </p>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        {connected ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive"
            onClick={onDisconnect}
          >
            Desconectar
          </Button>
        ) : step === "idle" ? (
          <>
            <ol className="mb-3 space-y-1 text-[12px] text-muted-foreground">
              {copy[channel].steps.map((s, i) => (
                <li key={s}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
            <Button className="w-full" onClick={() => setStep("number")}>
              Conectar
            </Button>
          </>
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
            <Button
              type="submit"
              className="w-full"
              disabled={phone.replace(/\D/g, "").length < 10}
            >
              Enviar código
            </Button>
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
              }, 1200);
            }}
          >
            <Field
              label="Código de 6 dígitos (demo: cualquier número)"
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
    </Card>
  );
}
