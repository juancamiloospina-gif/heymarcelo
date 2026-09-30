/**
 * Pure state transitions: every function takes the whole state and returns the next one,
 * plus what happened (for toasts). The store commits them; automations reuse them.
 */
import {
  BRIDGE_AFTER_MS,
  QUOTE_TTL_MS,
  allowedPrice,
  bridgeMessage,
  followup,
  jobMessage,
  type AutopilotResult,
} from "./marcelo-autopilot";
import {
  jobStart,
  nowISO,
  todayISO,
  uid,
  type AutoMessageKind,
  type Client,
  type Conversation,
  type InboxMessage,
  type Job,
  type MarceloState,
  type PaymentMethod,
  type Receivable,
} from "./marcelo-data";

export type OpEvent =
  | { type: "booked"; name: string; job: Job }
  | { type: "handoff"; name: string; note?: string | undefined }
  | { type: "blocked"; name: string }
  | { type: "queued"; kind: AutoMessageKind | "invoice"; name: string }
  | { type: "sent"; kind: AutoMessageKind | "invoice"; name: string }
  | { type: "expired"; name: string }
  | { type: "moved"; name: string; job: Job };

type Out = { s: MarceloState; events: OpEvent[] };

const patchConv = (
  s: MarceloState,
  id: string,
  fn: (c: Conversation) => Conversation,
): MarceloState => ({
  ...s,
  conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)),
});

const patchJob = (s: MarceloState, id: string, fn: (j: Job) => Job): MarceloState => ({
  ...s,
  jobs: s.jobs.map((j) => (j.id === id ? fn(j) : j)),
});

const clientName = (s: MarceloState, id?: string) =>
  s.clients.find((c) => c.id === id)?.name ?? "Cliente";

/** The chat where messages to this client go; created (demo) when there isn't one yet. */
export function ensureConversation(s: MarceloState, clientId: string): [MarceloState, string] {
  const existing = s.conversations.find((c) => c.clientId === clientId);
  if (existing) return [s, existing.id];
  const client = s.clients.find((c) => c.id === clientId);
  const conv: Conversation = {
    id: uid(),
    channel: s.connections.whatsapp.connected || !s.connections.sms.connected ? "whatsapp" : "sms",
    contactName: client?.name ?? "Cliente",
    phone: client?.phone ?? "",
    clientId,
    lang: "en",
    stage: "agendado",
    address: client?.address || undefined,
    messages: [],
    unread: false,
    updatedAt: nowISO(),
  };
  return [{ ...s, conversations: [conv, ...s.conversations] }, conv.id];
}

export function deliver(
  s: MarceloState,
  convId: string,
  reply: { text: string; es?: string | undefined },
  from: InboxMessage["from"] = "marcelo",
): MarceloState {
  return patchConv(s, convId, (c) => ({
    ...c,
    messages: [...c.messages, { id: uid(), from, text: reply.text, es: reply.es, at: nowISO() }],
    updatedAt: nowISO(),
  }));
}

/** Applies an autopilot result: reply, quote job, booking, address and follow-ups. */
export function applyResult(s: MarceloState, convId: string, result: AutopilotResult): Out {
  const conv = s.conversations.find((c) => c.id === convId);
  if (!conv) return { s, events: [] };
  const name = conv.contactName.split(" ")[0] ?? "";
  const events: OpEvent[] = [];

  // Guard: a quote may only carry the price table's price, or one the user chose explicitly.
  if (result.quote) {
    const merged = { ...conv, ...result.patch };
    const expected = allowedPrice(merged, result.quote.service, result.quote.size);
    if (result.quote.price !== expected) {
      const blocked = patchConv(s, convId, (c) => ({
        ...c,
        stage: "tu_turno",
        handoffAt: nowISO(),
        bridgeSent: false,
        unread: true,
      }));
      return { s: blocked, events: [{ type: "blocked", name }] };
    }
  }

  let next = s;
  let clientId = conv.clientId;
  let jobId = conv.jobId;

  if (result.quote) {
    const { service, price, size, slot } = result.quote;
    const address = result.patch.address ?? conv.address;
    if (!clientId) {
      const client: Client = {
        id: uid(),
        name: conv.contactName,
        phone: conv.phone,
        address: address ?? "",
        city: s.profile.city,
        service: service.name,
        price,
      };
      clientId = client.id;
      next = { ...next, clients: [...next.clients, client] };
    }
    const current = next.jobs.find((j) => j.id === jobId);
    const fields = {
      date: slot.date,
      time: slot.time,
      service: service.name,
      serviceId: service.id,
      price,
      size,
      address,
      status: "cotizado" as const,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    };
    if (current && current.status === "cotizado") {
      next = patchJob(next, current.id, (j) => ({ ...j, ...fields }));
    } else {
      const job: Job = { id: uid(), clientId, conversationId: convId, ...fields };
      jobId = job.id;
      next = { ...next, jobs: [...next.jobs, job] };
    }
  }

  if (result.confirm && jobId) {
    next = patchJob(next, jobId, (j) => ({
      ...j,
      status: "confirmado",
      expiresAt: undefined,
      sent: { ...j.sent, confirm: true },
    }));
    const job = next.jobs.find((j) => j.id === jobId);
    if (job) events.push({ type: "booked", name, job });
  }
  if (result.cancel && jobId) {
    next = patchJob(next, jobId, (j) =>
      j.status === "cotizado" ? { ...j, status: "cancelado" } : j,
    );
  }
  if (result.move) {
    next = moveJob(next, result.move.jobId, result.move.date, result.move.time);
    const job = next.jobs.find((j) => j.id === result.move!.jobId);
    if (job) events.push({ type: "moved", name, job });
  }
  if (result.saveAddress && clientId) {
    next = {
      ...next,
      clients: next.clients.map((c) =>
        c.id === clientId ? { ...c, address: result.saveAddress! } : c,
      ),
    };
  }
  if (result.pending) {
    next = {
      ...next,
      pendings: [
        { id: uid(), text: result.pending.text, clientId, done: false, createdAt: todayISO() },
        ...next.pendings,
      ],
    };
  }

  next = patchConv(next, convId, (c) => {
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    if (result.clientNote && last?.from === "client")
      messages[messages.length - 1] = { ...last, note: result.clientNote };
    if (result.reply)
      messages.push({
        id: uid(),
        from: "marcelo",
        text: result.reply.text,
        es: result.reply.es,
        at: nowISO(),
      });
    const handoff = result.event === "handoff";
    return {
      ...c,
      ...result.patch,
      clientId,
      jobId,
      messages,
      unread: true,
      updatedAt: nowISO(),
      ...(handoff ? { handoffAt: nowISO(), bridgeSent: false } : {}),
    };
  });
  if (result.event === "handoff") events.push({ type: "handoff", name, note: result.clientNote });
  return { s: next, events };
}

/** A job message: sent right away if the user chose "siempre automático", else queued for one tap. */
export function queueJobMessage(
  s: MarceloState,
  kind: AutoMessageKind | "invoice",
  jobId: string,
  opts: { eta?: number; force?: "ask" | "auto" } = {},
): Out {
  const job = s.jobs.find((j) => j.id === jobId);
  if (!job) return { s, events: [] };
  const [ensured, convId] = ensureConversation(s, job.clientId);
  let next = ensured;
  const conv = next.conversations.find((c) => c.id === convId)!;
  const service = next.services.find((x) => x.id === job.serviceId || x.name === job.service);
  const msg = jobMessage(kind, job, conv.lang, {
    clientName: clientName(next, job.clientId),
    service,
    eta: opts.eta,
    instructions: next.settings.paymentInstructions,
  });
  const text = msg.text;
  const es = msg.es ?? msg.text;
  const mode = opts.force ?? (kind === "invoice" ? "ask" : next.settings.autoMessages[kind]);
  next = patchJob(next, jobId, (j) => ({ ...j, sent: { ...j.sent, [kind]: true } }));
  const name = clientName(next, job.clientId).split(" ")[0] ?? "";
  if (mode === "auto") {
    return {
      s: deliver(next, convId, { text, es: conv.lang === "en" ? es : undefined }),
      events: [{ type: "sent", kind, name }],
    };
  }
  const outbox = next.outbox.filter((o) => !(o.jobId === jobId && o.kind === kind));
  return {
    s: {
      ...next,
      outbox: [
        ...outbox,
        { id: uid(), kind, jobId, conversationId: convId, text, es, createdAt: nowISO() },
      ],
    },
    events: [{ type: "queued", kind, name }],
  };
}

export function sendOutbox(s: MarceloState, id: string, always: boolean): Out {
  const item = s.outbox.find((o) => o.id === id);
  if (!item) return { s, events: [] };
  const conv = s.conversations.find((c) => c.id === item.conversationId);
  let next = deliver(s, item.conversationId, {
    text: item.text,
    es: conv?.lang === "en" ? item.es : undefined,
  });
  next = { ...next, outbox: next.outbox.filter((o) => o.id !== id) };
  if (always && item.kind !== "invoice") {
    next = {
      ...next,
      settings: {
        ...next.settings,
        autoMessages: { ...next.settings.autoMessages, [item.kind]: "auto" },
      },
    };
  }
  return {
    s: next,
    events: [{ type: "sent", kind: item.kind, name: conv?.contactName.split(" ")[0] ?? "" }],
  };
}

/** "Terminé": records the payment (or the debt) and closes the job. */
export function finishJob(
  s: MarceloState,
  jobId: string,
  amount: number,
  method: PaymentMethod | null,
): MarceloState {
  const job = s.jobs.find((j) => j.id === jobId);
  if (!job) return s;
  let next = patchJob(s, jobId, (j) => ({
    ...j,
    status: method ? "cobrado" : "hecho",
    price: amount,
  }));
  if (method) {
    next = {
      ...next,
      payments: [
        { id: uid(), clientId: job.clientId, jobId, amount, method, date: todayISO() },
        ...next.payments,
      ],
      // Anything already owed for this job is settled now.
      receivables: next.receivables.map((r) =>
        r.jobId === jobId && !r.paidAt ? { ...r, paidAt: todayISO() } : r,
      ),
    };
  } else if (!next.receivables.some((r) => r.jobId === jobId && !r.paidAt)) {
    const r: Receivable = {
      id: uid(),
      clientId: job.clientId,
      jobId,
      amount,
      note: job.service,
      createdAt: todayISO(),
    };
    next = { ...next, receivables: [r, ...next.receivables] };
  }
  return next;
}

/** "Cobré": a payment, optionally settling something in Por cobrar. */
export function recordPayment(
  s: MarceloState,
  p: {
    clientId: string;
    amount: number;
    method: PaymentMethod;
    receivableId?: string | undefined;
    note?: string | undefined;
  },
): MarceloState {
  const r = s.receivables.find((x) => x.id === p.receivableId);
  let next: MarceloState = {
    ...s,
    payments: [
      {
        id: uid(),
        clientId: p.clientId,
        jobId: r?.jobId,
        amount: p.amount,
        method: p.method,
        date: todayISO(),
        note: p.note,
      },
      ...s.payments,
    ],
  };
  if (r) {
    next = {
      ...next,
      receivables: next.receivables.map((x) => (x.id === r.id ? { ...x, paidAt: todayISO() } : x)),
    };
    if (r.jobId)
      next = patchJob(next, r.jobId, (j) =>
        j.status === "hecho" ? { ...j, status: "cobrado" } : j,
      );
  }
  return next;
}

/**
 * What Marcelo does on its own while the app is open (checked every minute):
 * expire old quotes with one follow-up, send the 15-minute bridge, queue 24 h reminders.
 */
export function tick(s: MarceloState, now = Date.now()): Out {
  let next = s;
  const events: OpEvent[] = [];

  for (const job of s.jobs) {
    if (job.status !== "cotizado") continue;
    const expired =
      (job.expiresAt && new Date(job.expiresAt).getTime() < now) || jobStart(job).getTime() < now;
    if (!expired) continue;
    next = patchJob(next, job.id, (j) => ({ ...j, status: "vencido" }));
    const conv = next.conversations.find((c) => c.jobId === job.id);
    const name = clientName(next, job.clientId).split(" ")[0] ?? "";
    events.push({ type: "expired", name });
    if (!conv) continue;
    const service = next.services.find((x) => x.id === job.serviceId);
    if (next.settings.autoReply && !conv.followupSent && conv.stage === "cotizado" && service) {
      // Detach the expired job so the follow-up quote creates a fresh one.
      next = patchConv(next, conv.id, (c) => ({ ...c, jobId: undefined, followupSent: true }));
      const fresh = next.conversations.find((c) => c.id === conv.id)!;
      const out = applyResult(next, conv.id, followup(next, fresh, service));
      next = out.s;
      events.push(...out.events);
    } else {
      // Never leave an offer open once its date has passed.
      next = patchConv(next, conv.id, (c) => ({
        ...c,
        proposal: undefined,
        stage: c.stage === "cotizado" ? "nuevo" : c.stage,
      }));
    }
  }

  if (next.settings.autoReply) {
    for (const conv of next.conversations) {
      if (conv.stage !== "tu_turno" || conv.bridgeSent || !conv.handoffAt) continue;
      if (now - new Date(conv.handoffAt).getTime() < BRIDGE_AFTER_MS) continue;
      next = deliver(next, conv.id, bridgeMessage(conv));
      next = patchConv(next, conv.id, (c) => ({ ...c, bridgeSent: true }));
    }
  }

  for (const job of next.jobs) {
    if (job.status !== "confirmado" || job.sent?.reminder) continue;
    const ms = jobStart(job).getTime() - now;
    if (ms > 0 && ms <= 24 * 3_600_000) {
      const out = queueJobMessage(next, "reminder", job.id);
      next = out.s;
      events.push(...out.events);
    }
  }
  return { s: next, events };
}

/** Moves a job to a new day/time; the 24 h reminder is re-armed and stale ones dropped. */
export function moveJob(s: MarceloState, jobId: string, date: string, time: string): MarceloState {
  return {
    ...patchJob(s, jobId, (j) => ({ ...j, date, time, sent: { ...j.sent, reminder: false } })),
    outbox: s.outbox.filter((o) => !(o.jobId === jobId && o.kind === "reminder")),
  };
}
