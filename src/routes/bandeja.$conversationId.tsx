import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CalendarCheck,
  Clock,
  Hand,
  Languages,
  Send,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Screen } from "@/components/marcelo/kit";
import { ChannelBadge, ClientAvatar, ServiceIcon, stageLabel } from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
import { askMarcelo } from "@/lib/marcelo.functions";
import { money, prettyDate, prettyTime, todayISO } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bandeja/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversación — Marcelo" },
      {
        name: "description",
        content: "Lo que te escribió tu cliente y lo que Marcelo le contestó.",
      },
    ],
  }),
  component: Conversacion,
});

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" });

function Conversacion() {
  const { conversationId } = useParams({ from: "/bandeja/$conversationId" });
  const {
    state,
    typingIn,
    receiveClientMessage,
    sendUserMessage,
    offerPrice,
    setConversationStage,
    markConversationRead,
  } = useMarcelo();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [as, setAs] = useState<"user" | "client">("user");
  const [sending, setSending] = useState(false);
  const [showEs, setShowEs] = useState(true);
  const [pricing, setPricing] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const conv = state.conversations.find((c) => c.id === conversationId);
  const service = state.services.find((s) => s.id === conv?.serviceId);
  const job = state.jobs.find((j) => j.id === conv?.jobId);
  const typing = typingIn.includes(conversationId);

  useEffect(() => {
    if (conv?.unread) markConversationRead(conversationId);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conv?.messages.length, conv?.unread, typing, conversationId, markConversationRead]);

  if (!conv) {
    return (
      <Screen>
        <p className="text-[15px] text-muted-foreground">No encontré esa conversación.</p>
      </Screen>
    );
  }

  const first = conv.contactName.split(" ")[0] ?? "";
  const stage = stageLabel[conv.stage];
  const price = conv.price ?? service?.price;
  const lastNote = [...conv.messages].reverse().find((m) => m.note)?.note;
  const handBack = () => setConversationStage(conv.id, conv.proposal ? "cotizado" : "nuevo");

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    if (as === "client") {
      receiveClientMessage({
        conversationId: conv.id,
        channel: conv.channel,
        contactName: conv.contactName,
        phone: conv.phone,
        text: value,
      });
      setText("");
      return;
    }
    if (conv.lang === "es") {
      sendUserMessage(conv.id, value);
      setText("");
      return;
    }
    setSending(true);
    try {
      const res = await askMarcelo({
        data: {
          text: `Dile a ${conv.contactName}: ${value}`,
          today: todayISO(),
          snapshot: `Cliente: ${conv.contactName}. Canal: ${conv.channel}.`,
        },
      });
      const en =
        res.ok && res.action?.type === "TRANSLATE_MESSAGE" ? String(res.action.en ?? "") : "";
      if (en) {
        sendUserMessage(conv.id, en, value);
      } else {
        sendUserMessage(conv.id, value);
        toast.info("Enviado en español", {
          description: "Marcelo no pudo traducirlo en este momento.",
        });
      }
      setText("");
    } catch {
      toast.error("No pude enviar el mensaje. Intenta otra vez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <button onClick={() => navigate({ to: "/bandeja" })} aria-label="Atrás" className="p-1">
          <ArrowLeft className="size-6" />
        </button>
        <ClientAvatar name={conv.contactName} size="sm" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">{conv.contactName}</h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <ChannelBadge channel={conv.channel} />
            <span className="truncate text-[11px] text-muted-foreground">{conv.phone}</span>
          </div>
        </div>
        {conv.clientId ? (
          <button
            aria-label="Ver cliente"
            onClick={() =>
              navigate({ to: "/clientes/$clientId", params: { clientId: conv.clientId! } })
            }
            className="rounded-full p-2 hover:bg-muted"
          >
            <UserRound className="size-5" />
          </button>
        ) : null}
      </div>

      <StatusBar>
        {conv.stage === "agendado" && job ? (
          <button
            onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } })}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-success/12 text-success">
              <CalendarCheck className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Marcelo agendó la cita</span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {job.service} · {prettyDate(job.date)}, {prettyTime(job.time)} · {money(job.price)}
              </span>
            </span>
            <Badge tone="success">Ver</Badge>
          </button>
        ) : conv.stage === "cotizado" && service && conv.proposal ? (
          <div className="flex items-center gap-3">
            <ServiceIcon kind={service.kind} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Esperando que {first} acepte</p>
              <p className="truncate text-[12px] text-muted-foreground">
                {service.name} · {money(price ?? 0)} · {prettyDate(conv.proposal.date)},{" "}
                {prettyTime(conv.proposal.time)}
              </p>
            </div>
            <Badge tone="warning">
              <Clock className="mr-1 size-3" /> Precio enviado
            </Badge>
          </div>
        ) : conv.stage === "tu_turno" ? (
          <div>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Hand className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">Marcelo te pasó este chat</p>
                <p className="text-[12px] text-muted-foreground">
                  {lastNote ?? "Necesita tu respuesta"}. Él no cambia tus precios sin ti.
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {service ? (
                <Button
                  size="sm"
                  variant="accent"
                  className="flex-1"
                  onClick={() => setPricing((v) => !v)}
                >
                  <Tag className="size-4" /> Ofrecer otro precio
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" className="flex-1" onClick={handBack}>
                <Bot className="size-4" /> Devolver a Marcelo
              </Button>
            </div>
            {pricing && service ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const p = Number(newPrice.replace(/[$,\s]/g, ""));
                  if (!(p > 0)) return;
                  offerPrice(conv.id, p);
                  setPricing(false);
                  setNewPrice("");
                  toast.success(`Marcelo le ofreció ${money(p)} a ${first}`);
                }}
              >
                <input
                  autoFocus
                  inputMode="decimal"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder={`Precio normal ${money(service.price)}`}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-[15px] outline-none focus:border-accent"
                />
                <Button size="sm" type="submit">
                  Enviar
                </Button>
              </form>
            ) : null}
          </div>
        ) : conv.stage === "manual" ? (
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Hand className="size-5" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
              Estás respondiendo tú. Marcelo está en pausa en este chat.
            </p>
            <Button size="sm" variant="secondary" onClick={handBack}>
              <Bot className="size-4" /> Devolver
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Badge tone={stage.tone}>{stage.label}</Badge>
            {state.settings.autoReply
              ? "Marcelo contesta automáticamente."
              : "La respuesta automática está apagada."}
          </div>
        )}
      </StatusBar>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conv.lang === "en" ? (
          <div className="flex justify-center">
            <button
              onClick={() => setShowEs((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground"
            >
              <Languages className="size-3.5" />
              {showEs ? "Viendo traducción al español" : "Ver traducción al español"}
            </button>
          </div>
        ) : null}

        {conv.messages.map((m) =>
          m.from === "client" ? (
            <div key={m.id} className="flex flex-col items-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{hhmm(m.at)}</p>
              </div>
              {m.note ? (
                <span className="mt-1.5 flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                  <Sparkles className="size-3" /> Marcelo entendió: {m.note}
                </span>
              ) : null}
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-end">
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl rounded-tr-md px-4 py-3 shadow-sm",
                  m.from === "marcelo"
                    ? "border border-accent/20 bg-accent/10"
                    : "bg-primary text-primary-foreground",
                )}
              >
                <p
                  className={cn(
                    "mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide",
                    m.from === "marcelo" ? "text-accent" : "text-primary-foreground/60",
                  )}
                >
                  {m.from === "marcelo" ? (
                    <>
                      <Bot className="size-3" /> Marcelo · automático
                    </>
                  ) : (
                    "Tú"
                  )}
                </p>
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{m.text}</p>
                {showEs && m.es ? (
                  <p
                    className={cn(
                      "mt-2 whitespace-pre-line border-t pt-2 text-[13px] leading-relaxed",
                      m.from === "marcelo"
                        ? "border-accent/15 text-muted-foreground"
                        : "border-primary-foreground/15 text-primary-foreground/70",
                    )}
                  >
                    {m.es}
                  </p>
                ) : null}
                <p
                  className={cn(
                    "mt-1 text-right text-[11px]",
                    m.from === "marcelo" ? "text-muted-foreground" : "text-primary-foreground/50",
                  )}
                >
                  {hhmm(m.at)}
                </p>
              </div>
            </div>
          ),
        )}

        {typing ? (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-2xl rounded-tr-md border border-accent/20 bg-accent/10 px-4 py-3">
              <Bot className="size-4 text-accent" />
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-bounce rounded-full bg-accent"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t bg-card px-4 pb-6 pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">Escribir como:</span>
          {(
            [
              { key: "user", label: "Tú" },
              { key: "client", label: `${first} (demo)` },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              onClick={() => setAs(o.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                as === o.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              as === "client"
                ? `Lo que respondería ${first}, ej. "Yes, that works"`
                : conv.lang === "en"
                  ? "Escribe en español, Marcelo lo traduce"
                  : "Escribe tu mensaje"
            }
            className={cn(
              "h-12 w-full rounded-2xl px-4 pr-12 text-[15px] outline-none transition-all focus:ring-2",
              as === "client"
                ? "bg-warning/15 focus:ring-warning/40"
                : "bg-muted/60 focus:ring-accent/30",
            )}
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!text.trim() || sending}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-xl text-accent disabled:text-muted-foreground/30"
          >
            <Send className="size-4" />
          </button>
        </form>
        {as === "user" && conv.stage !== "manual" && conv.stage !== "agendado" ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Si respondes tú, Marcelo se pausa en este chat.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusBar({ children }: { children: React.ReactNode }) {
  return <div className="border-b bg-card/70 px-4 py-3">{children}</div>;
}
