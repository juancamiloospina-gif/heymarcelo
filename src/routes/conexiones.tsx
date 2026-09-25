import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
} from "@/components/marcelo/kit";
import { channelVisual } from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
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
      <button
        onClick={() => window.history.back()}
        aria-label="Atrás"
        className="mb-2 text-muted-foreground"
      >
        <ArrowLeft className="size-6" />
      </button>
      <PageTitle title="Conexiones" subtitle="Dónde te escriben tus clientes." />

      <Card className="mb-5 flex items-start gap-3 border-warning/30 bg-warning/10">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        <p className="text-[13px] leading-relaxed text-warning-foreground">
          <b>Modo demo.</b> Estas conexiones todavía no envían ni reciben mensajes reales. Sirven
          para probar cómo Marcelo contesta y agenda. Usa “Simular mensaje” en Mensajes.
        </p>
      </Card>

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

      <SectionTitle>Cómo funciona</SectionTitle>
      <Card className="space-y-3 text-[14px] leading-relaxed text-muted-foreground">
        <Step n={1}>Un cliente te escribe pidiendo un servicio.</Step>
        <Step n={2}>Marcelo le contesta en su idioma con tu precio y el primer espacio libre.</Step>
        <Step n={3}>Si acepta, la cita queda en tu agenda y el cliente en tu lista.</Step>
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
            <Badge tone="warning">Demo</Badge>
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
