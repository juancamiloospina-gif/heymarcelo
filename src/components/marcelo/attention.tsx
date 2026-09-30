import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Ban,
  BellRing,
  ChevronRight,
  HandCoins,
  Hand,
  PencilLine,
  Send,
  Tag,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Sheet } from "./kit";
import { IconChip, type Tone } from "./visual";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  declineConv,
  discountPrice,
  holdPrice,
  offerPrice,
  requote,
  type AutopilotResult,
} from "@/lib/marcelo-autopilot";
import {
  daysBetween,
  money,
  priceFor,
  todayISO,
  type Conversation,
  type OutboxItem,
} from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

const outboxLabel: Record<OutboxItem["kind"], string> = {
  confirm: "Confirmación",
  reminder: "Recordatorio del trabajo",
  onTheWay: "Voy en camino",
  invoice: "Factura",
};

type Item = {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
};

/** Everything that needs the user, most urgent first: clients waiting, messages to send, money owed. */
export function useAttention(): { items: Item[]; sheet: React.ReactNode } {
  const { state, clientById } = useMarcelo();
  const navigate = useNavigate();
  const [outboxId, setOutboxId] = useState<string | null>(null);
  const [decideId, setDecideId] = useState<string | null>(null);
  const items: Item[] = [];

  for (const c of state.conversations.filter((x) => x.stage === "tu_turno")) {
    const note = [...c.messages].reverse().find((m) => m.note)?.note;
    items.push({
      id: `conv-${c.id}`,
      icon: Hand,
      tone: "danger",
      title: `${c.contactName.split(" ")[0]} espera tu respuesta`,
      body: note ?? "Marcelo no supo qué contestar.",
      cta: "Responder",
      onClick: () => setDecideId(c.id),
    });
  }
  for (const o of state.outbox) {
    const job = state.jobs.find((j) => j.id === o.jobId);
    items.push({
      id: `out-${o.id}`,
      icon: BellRing,
      tone: "accent",
      title: `${outboxLabel[o.kind]} para ${clientById(job?.clientId)?.name.split(" ")[0] ?? "tu cliente"}`,
      body: "Listo en inglés. Revísalo y envíalo.",
      cta: "Revisar",
      onClick: () => setOutboxId(o.id),
    });
  }
  for (const r of state.receivables.filter(
    (x) => !x.paidAt && daysBetween(x.createdAt, todayISO()) >= 2,
  )) {
    items.push({
      id: `owe-${r.id}`,
      icon: HandCoins,
      tone: "warning",
      title: `${clientById(r.clientId)?.name.split(" ")[0] ?? "Un cliente"} te debe ${money(r.amount)}`,
      body: `Hace ${daysBetween(r.createdAt, todayISO())} días.`,
      cta: "Ver",
      onClick: () => navigate({ to: "/dinero", search: { tab: "cobrar" } }),
    });
  }
  const soon = Date.now() + 6 * 3_600_000;
  for (const j of state.jobs.filter(
    (x) => x.status === "cotizado" && x.expiresAt && new Date(x.expiresAt).getTime() < soon,
  )) {
    items.push({
      id: `exp-${j.id}`,
      icon: Timer,
      tone: "teal",
      title: `La cotización a ${clientById(j.clientId)?.name.split(" ")[0] ?? "tu cliente"} vence pronto`,
      body: "Marcelo le escribirá una vez si no contesta.",
      cta: "Ver",
      onClick: () => navigate({ to: "/trabajo/$jobId", params: { jobId: j.id } }),
    });
  }

  const outbox = state.outbox.find((o) => o.id === outboxId);
  const conv = state.conversations.find((c) => c.id === decideId);
  const sheet = (
    <>
      {outbox ? <OutboxSheet item={outbox} onClose={() => setOutboxId(null)} /> : null}
      {conv ? <DecisionSheet conv={conv} onClose={() => setDecideId(null)} /> : null}
    </>
  );
  return { items, sheet };
}

export function AttentionList({
  limit = 4,
  emptyHidden = true,
}: {
  limit?: number;
  emptyHidden?: boolean;
}) {
  const { items, sheet } = useAttention();
  const [all, setAll] = useState(false);
  if (!items.length && emptyHidden) return null;
  const shown = all ? items : items.slice(0, limit);
  return (
    <section className="mb-2">
      <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.06em] text-destructive">
        <span className="size-2 rounded-full bg-destructive" /> Necesitan tu atención
        <span className="rounded-full bg-destructive/10 px-2 text-[12px]">{items.length}</span>
      </h2>
      <div className="space-y-2">
        {shown.map((it) => (
          <Card key={it.id} className="flex items-center gap-3 p-3.5" onClick={it.onClick}>
            <IconChip icon={it.icon} tone={it.tone} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-snug">{it.title}</p>
              <p className="truncate text-[14px] text-muted-foreground">{it.body}</p>
            </div>
            <span className="flex shrink-0 items-center text-[14px] font-bold text-accent">
              {it.cta} <ChevronRight className="size-4" />
            </span>
          </Card>
        ))}
      </div>
      {items.length > limit && !all ? (
        <button
          onClick={() => setAll(true)}
          className="mt-2 h-12 w-full text-[15px] font-semibold text-accent"
        >
          Ver {items.length - limit} más
        </button>
      ) : null}
      {sheet}
    </section>
  );
}

function Preview({ text, es }: { text: string; es?: string | undefined }) {
  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
      <p className="text-[12px] font-bold uppercase tracking-wide text-accent">
        Lo que recibe tu cliente
      </p>
      <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed">{text}</p>
      {es ? (
        <>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            En español
          </p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
            {es}
          </p>
        </>
      ) : null}
    </div>
  );
}

export function OutboxSheet({ item, onClose }: { item: OutboxItem; onClose: () => void }) {
  const { sendOutbox, dismissOutbox, state } = useMarcelo();
  const [always, setAlways] = useState(false);
  const conv = state.conversations.find((c) => c.id === item.conversationId);
  return (
    <Sheet
      title={outboxLabel[item.kind]}
      icon={<BellRing className="size-5 text-accent" />}
      onClose={onClose}
    >
      <p className="mb-3 text-[15px] text-muted-foreground">
        Para {conv?.contactName ?? "tu cliente"}
      </p>
      <Preview text={item.text} es={conv?.lang === "en" ? item.es : undefined} />
      {item.kind !== "invoice" ? (
        <label className="mt-4 flex min-h-12 items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={always}
            onChange={(e) => setAlways(e.target.checked)}
            className="size-5 accent-[var(--color-accent)]"
          />
          Enviar siempre automático
        </label>
      ) : null}
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            dismissOutbox(item.id);
            onClose();
          }}
        >
          No enviar
        </Button>
        <Button
          onClick={() => {
            sendOutbox(item.id, always);
            toast.success("Mensaje enviado");
            onClose();
          }}
        >
          <Send className="size-5" /> Enviar
        </Button>
      </div>
    </Sheet>
  );
}

type Choice = "hold" | "discount" | "decline";

/** "Responder" to a client Marcelo handed over: three one-tap answers, each previewed. */
export function DecisionSheet({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const { state, sendPrepared } = useMarcelo();
  const navigate = useNavigate();
  const service = state.services.find((s) => s.id === conv.serviceId);
  const base = service ? priceFor(service, conv.size) : 0;
  const discounted = discountPrice(base, 0.1);
  const [choice, setChoice] = useState<Choice | null>(null);

  const result: AutopilotResult | null =
    choice === "hold" && service
      ? holdPrice(state, conv, service)
      : choice === "discount" && service
        ? offerPrice(state, conv, service, discounted)
        : choice === "decline"
          ? declineConv(conv)
          : null;

  const options: { key: Choice; icon: LucideIcon; label: string; hint: string; show: boolean }[] = [
    {
      key: "hold",
      icon: Tag,
      label: `Mantener precio (${money(base)})`,
      hint: "Con el primer horario libre",
      show: Boolean(service),
    },
    {
      key: "discount",
      icon: HandCoins,
      label: `Ofrecer 10% de descuento (${money(discounted)})`,
      hint: "Solo para este cliente",
      show: Boolean(service),
    },
    { key: "decline", icon: Ban, label: "Declinar", hint: "Con un mensaje amable", show: true },
  ];

  return (
    <Sheet title={`Responder a ${conv.contactName.split(" ")[0]}`} onClose={onClose}>
      <p className="mb-3 text-[15px] text-muted-foreground">
        {[...conv.messages].reverse().find((m) => m.from === "client")?.text}
      </p>
      <div className="space-y-2">
        {options
          .filter((o) => o.show)
          .map((o) => (
            <button
              key={o.key}
              onClick={() => setChoice(o.key)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                choice === o.key ? "border-accent bg-accent/5" : "border-border",
              )}
            >
              <o.icon
                className={cn(
                  "size-5 shrink-0",
                  o.key === "decline" ? "text-destructive" : "text-accent",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{o.label}</span>
                <span className="block text-[14px] text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
      </div>
      {result?.reply ? (
        <div className="mt-4">
          <Preview text={result.reply.text} es={result.reply.es} />
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            onClose();
            navigate({ to: "/bandeja/$conversationId", params: { conversationId: conv.id } });
          }}
        >
          <PencilLine className="size-5" /> Escribir yo
        </Button>
        <Button
          disabled={!result}
          onClick={() => {
            if (!result) return;
            sendPrepared(conv.id, result);
            toast.success("Respuesta enviada");
            onClose();
          }}
        >
          <Send className="size-5" /> Enviar
        </Button>
      </div>
    </Sheet>
  );
}

/** "¿No es esto?": the user picks the right service and Marcelo corrects itself. */
export function ServiceFixSheet({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const { state, sendPrepared } = useMarcelo();
  const [pick, setPick] = useState<string | null>(null);
  const service = state.services.find((s) => s.id === pick);
  const result = service ? requote(state, conv, service) : null;
  return (
    <Sheet title="¿Qué pidió en realidad?" onClose={onClose}>
      <div className="space-y-2">
        {state.services.map((s) => (
          <button
            key={s.id}
            onClick={() => setPick(s.id)}
            className={cn(
              "flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-[16px]",
              pick === s.id ? "border-accent bg-accent/5 font-semibold" : "border-border",
            )}
          >
            {s.name}
            <span className="text-muted-foreground">{money(s.price)}</span>
          </button>
        ))}
      </div>
      {result?.reply ? (
        <div className="mt-4">
          <Preview text={result.reply.text} es={result.reply.es} />
        </div>
      ) : null}
      <Button
        className="mt-4 w-full"
        disabled={!result}
        onClick={() => {
          if (!result) return;
          sendPrepared(conv.id, { ...result, clientNote: `Pide: ${service!.name}` });
          toast.success("Marcelo corrigió la respuesta");
          onClose();
        }}
      >
        <Send className="size-5" /> Enviar corrección
      </Button>
    </Sheet>
  );
}
