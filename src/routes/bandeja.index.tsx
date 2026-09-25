import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, FlaskConical, Link2, MessageCirclePlus, Plug, Send, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
} from "@/components/marcelo/kit";
import {
  ChannelBadge,
  ChannelDot,
  ClientAvatar,
  IconChip,
  stageLabel,
} from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
import type { Channel } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bandeja/")({
  head: () => ({
    meta: [
      { title: "Mensajes de clientes — Marcelo" },
      {
        name: "description",
        content:
          "Marcelo contesta a tus clientes por WhatsApp o SMS y agenda la cita cuando aceptan tu precio.",
      },
      { property: "og:title", content: "Mensajes de clientes — Marcelo" },
      {
        property: "og:description",
        content: "Respuestas automáticas con tus precios y citas agendadas solas.",
      },
    ],
  }),
  component: Bandeja,
});

const samples = [
  { name: "Jessica Brown", text: "Hi! How much do you charge to mow a small front lawn?" },
  { name: "Mike Torres", text: "Hey, can you trim my hedges this Saturday morning?" },
  { name: "Linda Nguyen", text: "Do you install sprinklers? My backyard needs a new system." },
  { name: "Rosa Hernández", text: "Hola, necesito limpieza del jardín, ¿cuánto cobra?" },
];

const timeAgo = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "short" });
};

function Bandeja() {
  const { state, setSettings, receiveClientMessage } = useMarcelo();
  const navigate = useNavigate();
  const [simOpen, setSimOpen] = useState(false);

  const connected = (Object.keys(state.connections) as Channel[]).filter(
    (c) => state.connections[c].connected,
  );
  const list = [...state.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const waiting = list.filter((c) => c.stage === "tu_turno").length;
  const booked = list.filter((c) => c.stage === "agendado").length;

  return (
    <Screen>
      <PageTitle
        title="Mensajes"
        subtitle={
          waiting
            ? `${waiting} ${waiting === 1 ? "cliente espera" : "clientes esperan"} tu respuesta`
            : "Marcelo contesta por ti"
        }
      />

      {connected.length === 0 ? (
        <Card
          className="mb-4 flex items-center gap-3 border-accent/20 bg-accent/5"
          onClick={() => navigate({ to: "/conexiones" })}
        >
          <IconChip icon={Plug} tone="accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Conecta WhatsApp o SMS</p>
            <p className="text-[13px] text-muted-foreground">
              Para que tus clientes te escriban aquí.
            </p>
          </div>
        </Card>
      ) : null}

      <Card className="mb-4 overflow-hidden bg-primary p-0 text-primary-foreground">
        <div className="flex items-center gap-3 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Respuesta automática</p>
            <p className="text-[12px] leading-snug text-primary-foreground/65">
              Cotiza con tus precios y agenda cuando el cliente acepta.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={state.settings.autoReply}
            aria-label="Respuesta automática"
            onClick={() => setSettings({ autoReply: !state.settings.autoReply })}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              state.settings.autoReply ? "bg-accent" : "bg-primary-foreground/20",
            )}
          >
            <span
              className={cn(
                "absolute top-1 size-5 rounded-full bg-card shadow transition-all",
                state.settings.autoReply ? "left-6" : "left-1",
              )}
            />
          </button>
        </div>
        <div className="grid grid-cols-3 border-t border-primary-foreground/10 text-center">
          <Stat value={list.length} label="Chats" />
          <Stat value={booked} label="Agendados" />
          <Stat value={waiting} label="Te necesitan" highlight={waiting > 0} />
        </div>
      </Card>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/servicios" })}>
          Mis precios
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/conexiones" })}>
          <Link2 className="size-4" /> Conexiones
        </Button>
      </div>

      <SectionTitle
        action={
          <button
            onClick={() => setSimOpen(true)}
            className="flex items-center gap-1 text-[13px] font-semibold text-accent"
          >
            <FlaskConical className="size-3.5" /> Simular mensaje
          </button>
        }
      >
        Conversaciones
      </SectionTitle>

      {list.length === 0 ? (
        <Empty
          title="Todavía no hay mensajes."
          hint="Cuando un cliente te escriba por WhatsApp o SMS, aparece aquí y Marcelo le contesta."
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {list.map((c) => {
            const last = c.messages[c.messages.length - 1];
            const preview = last
              ? last.from === "client"
                ? last.text
                : `${last.from === "marcelo" ? "Marcelo" : "Tú"}: ${last.es ?? last.text}`
              : "";
            const stage = stageLabel[c.stage];
            return (
              <button
                key={c.id}
                onClick={() =>
                  navigate({ to: "/bandeja/$conversationId", params: { conversationId: c.id } })
                }
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
              >
                <div className="relative">
                  <ClientAvatar name={c.contactName} />
                  <ChannelDot channel={c.channel} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[15px]",
                        c.unread ? "font-bold" : "font-semibold",
                      )}
                    >
                      {c.contactName}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(c.updatedAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 line-clamp-2 text-[13px] leading-snug",
                      c.unread ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {preview}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={stage.tone}>{stage.label}</Badge>
                    {c.unread ? (
                      <span className="size-2 rounded-full bg-accent" aria-label="Sin leer" />
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </Card>
      )}

      {simOpen ? (
        <Simulator
          channels={connected}
          onClose={() => setSimOpen(false)}
          onSend={(input) => {
            const id = receiveClientMessage(input);
            setSimOpen(false);
            navigate({ to: "/bandeja/$conversationId", params: { conversationId: id } });
          }}
        />
      ) : null}
    </Screen>
  );
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="px-2 py-3">
      <p className={cn("text-[18px] font-bold", highlight && "text-accent")}>{value}</p>
      <p className="text-[11px] text-primary-foreground/60">{label}</p>
    </div>
  );
}

function Simulator({
  channels,
  onClose,
  onSend,
}: {
  channels: Channel[];
  onClose: () => void;
  onSend: (input: { channel: Channel; contactName: string; phone: string; text: string }) => void;
}) {
  const [name, setName] = useState(samples[0]?.name ?? "");
  const [text, setText] = useState(samples[0]?.text ?? "");
  const [channel, setChannel] = useState<Channel>(channels[0] ?? "whatsapp");
  // Same name → same fake number, so a second simulated message lands in the same chat.
  const fakePhone = (n: string) =>
    `(323) 555-0${String(100 + ([...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 899))}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Simular mensaje de cliente"
        className="w-full max-w-md rounded-t-[1.75rem] bg-card p-5 pb-8 shadow-[var(--shadow-lift)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[17px] font-bold">
              <MessageCirclePlus className="size-5 text-accent" /> Simular mensaje
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Modo demo: así se ve cuando un cliente te escribe.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
          {samples.map((s) => (
            <button
              key={s.name}
              onClick={() => {
                setName(s.name);
                setText(s.text);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium",
                name === s.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {s.name.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <Field
            label="Nombre del cliente"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Mensaje
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </label>
          <div className="flex gap-2">
            {(["whatsapp", "sms"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5",
                  channel === ch ? "border-accent bg-accent/5" : "border-border",
                )}
              >
                <ChannelBadge channel={ch} />
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={!name.trim() || !text.trim()}
            onClick={() =>
              onSend({
                channel,
                contactName: name.trim(),
                phone: fakePhone(name.trim()),
                text: text.trim(),
              })
            }
          >
            <Send className="size-4" /> Recibir mensaje
          </Button>
        </div>
      </div>
    </div>
  );
}
