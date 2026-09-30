import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { detectLang, runAutopilot, type AutopilotResult } from "./marcelo-autopilot";
import {
  demoState,
  digits,
  migrate,
  monthISO,
  nowISO,
  prettyDate,
  prettyTime,
  todayISO,
  uid,
  type AutoMessageKind,
  type Channel,
  type Client,
  type Connection,
  type Conversation,
  type Expense,
  type InboxMessage,
  type Job,
  type MarceloState,
  type Message,
  type MileLog,
  type PaymentMethod,
  type Pending,
  type Profile,
  type Receivable,
  type Service,
  type Settings,
} from "./marcelo-data";
import * as ops from "./marcelo-ops";
import { translate } from "./ai/ask";

const KEY = "marcelo.state.v1";
const TICK_MS = 60_000;

type Store = {
  state: MarceloState;
  ready: boolean;
  setProfile: (p: Partial<Profile>) => void;
  addClient: (c: Omit<Client, "id">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  addJob: (j: Omit<Job, "id">) => Job;
  updateJob: (id: string, patch: Partial<Job>) => void;
  removeJob: (id: string) => void;
  /** "Terminé": amount paid and method, or null when the client still owes it. */
  finishJob: (jobId: string, amount: number, method: PaymentMethod | null) => void;
  /** Sets the job en camino and prepares the "Voy en camino" message. */
  startTrip: (jobId: string) => void;
  queueJobMessage: (
    kind: AutoMessageKind | "invoice",
    jobId: string,
    force?: "ask" | "auto",
  ) => void;
  sendOutbox: (id: string, always: boolean) => void;
  dismissOutbox: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => Expense;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => Expense | undefined;
  restoreExpense: (e: Expense) => void;
  recordPayment: (p: {
    clientId: string;
    amount: number;
    method: PaymentMethod;
    receivableId?: string | undefined;
    note?: string | undefined;
  }) => void;
  addReceivable: (r: Omit<Receivable, "id" | "createdAt">) => void;
  addMiles: (m: Omit<MileLog, "id">) => void;
  removeMiles: (id: string) => void;
  addPending: (text: string, extra?: Partial<Pending>) => Pending;
  togglePending: (id: string) => void;
  removePending: (id: string) => Pending | undefined;
  restorePending: (p: Pending) => void;
  clearDonePendings: () => void;
  addMessage: (m: Omit<Message, "id">) => Message;
  addService: (s: Omit<Service, "id">) => void;
  updateService: (id: string, patch: Partial<Service>) => void;
  removeService: (id: string) => Service | undefined;
  restoreService: (s: Service) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setConnection: (channel: Channel, patch: Partial<Connection>) => void;
  receiveClientMessage: (input: {
    conversationId?: string;
    channel: Channel;
    contactName: string;
    phone: string;
    text: string;
    photo?: boolean;
  }) => string;
  sendUserMessage: (conversationId: string, text: string, es?: string) => void;
  /** Spanish version of a client's English message (done automatically on arrival). */
  translateClientMessage: (conversationId: string, messageId: string) => Promise<boolean>;
  /** Moves a booked job; `notify` prepares the new time for the client to review. */
  moveJobTo: (jobId: string, date: string, time: string, notify: boolean) => void;
  dismissMove: (conversationId: string, key: string) => void;
  /** Sends a reply the user reviewed (one-tap decisions, corrections). */
  sendPrepared: (conversationId: string, result: AutopilotResult) => void;
  setConversationStage: (conversationId: string, stage: Conversation["stage"]) => void;
  markConversationRead: (conversationId: string) => void;
  typingIn: string[];
  reset: () => void;
  clientById: (id?: string) => Client | undefined;
  findClientByName: (name: string) => Client | undefined;
};

const Ctx = createContext<Store | null>(null);

function announce(events: ops.OpEvent[]) {
  for (const e of events) {
    if (e.type === "booked") {
      toast.success(`Marcelo agendó a ${e.name}`, {
        description: `${e.job.service} · ${prettyDate(e.job.date)}, ${prettyTime(e.job.time)}`,
      });
    } else if (e.type === "moved") {
      toast.success(`Marcelo movió el trabajo de ${e.name}`, {
        description: `${prettyDate(e.job.date)}, ${prettyTime(e.job.time)}`,
      });
    } else if (e.type === "handoff") {
      toast(`${e.name} necesita tu respuesta`, { description: e.note });
    } else if (e.type === "blocked") {
      toast.error(`Marcelo frenó una cotización a ${e.name}`, {
        description: "El precio no coincidía con tu tabla. Revísalo tú.",
      });
    } else if (e.type === "queued") {
      toast(`Mensaje listo para ${e.name}`, { description: "Revísalo y toca Enviar." });
    }
  }
}

export function MarceloProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarceloState>(() => demoState());
  const [ready, setReady] = useState(false);
  const [typingIn, setTypingIn] = useState<string[]>([]);
  // Single source of truth for writes, so back-to-back actions never overwrite each other.
  const ref = useRef(state);

  const commit = useCallback((fn: (s: MarceloState) => MarceloState) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
    return next;
  }, []);

  const run = useCallback((fn: (s: MarceloState) => { s: MarceloState; events: ops.OpEvent[] }) => {
    const out = fn(ref.current);
    ref.current = out.s;
    setState(out.s);
    announce(out.events);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const loaded = migrate(JSON.parse(raw));
        ref.current = loaded;
        setState(loaded);
      }
    } catch {
      /* ignore corrupted storage */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state, ready]);

  // Automations run while the app is open: expiring quotes, 15-min bridge, 24 h reminders.
  useEffect(() => {
    if (!ready) return;
    // Background work speaks through "Necesitan tu atención"; only bookings/handoffs toast.
    const tick = () =>
      run((s) => {
        const out = ops.tick(s);
        return {
          ...out,
          events: out.events.filter((e) => e.type !== "queued" && e.type !== "expired"),
        };
      });
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [ready, run]);

  const setProfile = useCallback(
    (p: Partial<Profile>) => commit((s) => ({ ...s, profile: { ...s.profile, ...p } })),
    [commit],
  );

  const addClient = useCallback(
    (c: Omit<Client, "id">) => {
      const client: Client = { ...c, id: uid() };
      commit((s) => ({ ...s, clients: [...s.clients, client] }));
      return client;
    },
    [commit],
  );

  const updateClient = useCallback(
    (id: string, patch: Partial<Client>) =>
      commit((s) => ({
        ...s,
        clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    [commit],
  );

  const addJob = useCallback(
    (j: Omit<Job, "id">) => {
      const job: Job = { ...j, id: uid() };
      commit((s) => ({ ...s, jobs: [...s.jobs, job] }));
      return job;
    },
    [commit],
  );

  const updateJob = useCallback(
    (id: string, patch: Partial<Job>) =>
      commit((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
    [commit],
  );

  const removeJob = useCallback(
    (id: string) => commit((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== id) })),
    [commit],
  );

  const finishJob = useCallback(
    (jobId: string, amount: number, method: PaymentMethod | null) =>
      commit((s) => ops.finishJob(s, jobId, amount, method)),
    [commit],
  );

  const queueJobMessage = useCallback(
    (kind: AutoMessageKind | "invoice", jobId: string, force?: "ask" | "auto") =>
      run((s) => ops.queueJobMessage(s, kind, jobId, force ? { force } : {})),
    [run],
  );

  const startTrip = useCallback(
    (jobId: string) =>
      run((s) =>
        ops.queueJobMessage(
          { ...s, jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, status: "en_camino" } : j)) },
          "onTheWay",
          jobId,
        ),
      ),
    [run],
  );

  const sendOutbox = useCallback(
    (id: string, always: boolean) => run((s) => ops.sendOutbox(s, id, always)),
    [run],
  );

  const dismissOutbox = useCallback(
    (id: string) => commit((s) => ({ ...s, outbox: s.outbox.filter((o) => o.id !== id) })),
    [commit],
  );

  const addExpense = useCallback(
    (e: Omit<Expense, "id">) => {
      const expense: Expense = { ...e, id: uid() };
      commit((s) => ({ ...s, expenses: [expense, ...s.expenses] }));
      return expense;
    },
    [commit],
  );

  const updateExpense = useCallback(
    (id: string, patch: Partial<Expense>) =>
      commit((s) => ({
        ...s,
        expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    [commit],
  );

  const removeExpense = useCallback(
    (id: string) => {
      const found = ref.current.expenses.find((e) => e.id === id);
      commit((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
      return found;
    },
    [commit],
  );

  const restoreExpense = useCallback(
    (e: Expense) =>
      commit((s) => ({ ...s, expenses: [e, ...s.expenses.filter((x) => x.id !== e.id)] })),
    [commit],
  );

  const recordPayment = useCallback(
    (p: Parameters<Store["recordPayment"]>[0]) => commit((s) => ops.recordPayment(s, p)),
    [commit],
  );

  const addReceivable = useCallback(
    (r: Omit<Receivable, "id" | "createdAt">) =>
      commit((s) => ({
        ...s,
        receivables: [{ ...r, id: uid(), createdAt: todayISO() }, ...s.receivables],
      })),
    [commit],
  );

  const addMiles = useCallback(
    (m: Omit<MileLog, "id">) => commit((s) => ({ ...s, miles: [{ ...m, id: uid() }, ...s.miles] })),
    [commit],
  );

  const removeMiles = useCallback(
    (id: string) => commit((s) => ({ ...s, miles: s.miles.filter((m) => m.id !== id) })),
    [commit],
  );

  const addPending = useCallback(
    (text: string, extra?: Partial<Pending>) => {
      const pending: Pending = { id: uid(), text, done: false, createdAt: todayISO(), ...extra };
      commit((s) => ({ ...s, pendings: [pending, ...s.pendings] }));
      return pending;
    },
    [commit],
  );

  const togglePending = useCallback(
    (id: string) =>
      commit((s) => ({
        ...s,
        pendings: s.pendings.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
      })),
    [commit],
  );

  const removePending = useCallback(
    (id: string) => {
      const found = ref.current.pendings.find((p) => p.id === id);
      commit((s) => ({ ...s, pendings: s.pendings.filter((p) => p.id !== id) }));
      return found;
    },
    [commit],
  );

  const restorePending = useCallback(
    (p: Pending) =>
      commit((s) => ({ ...s, pendings: [p, ...s.pendings.filter((x) => x.id !== p.id)] })),
    [commit],
  );

  const clearDonePendings = useCallback(
    () => commit((s) => ({ ...s, pendings: s.pendings.filter((p) => !p.done) })),
    [commit],
  );

  const addMessage = useCallback(
    (m: Omit<Message, "id">) => {
      const message: Message = { ...m, id: uid() };
      commit((s) => ({ ...s, messages: [message, ...s.messages] }));
      return message;
    },
    [commit],
  );

  const addService = useCallback(
    (svc: Omit<Service, "id">) =>
      commit((s) => ({ ...s, services: [...s.services, { ...svc, id: uid() }] })),
    [commit],
  );

  const updateService = useCallback(
    (id: string, patch: Partial<Service>) =>
      commit((s) => ({
        ...s,
        services: s.services.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      })),
    [commit],
  );

  const removeService = useCallback(
    (id: string) => {
      const found = ref.current.services.find((x) => x.id === id);
      commit((s) => ({ ...s, services: s.services.filter((x) => x.id !== id) }));
      return found;
    },
    [commit],
  );

  const restoreService = useCallback(
    (svc: Service) =>
      commit((s) => ({ ...s, services: [...s.services.filter((x) => x.id !== svc.id), svc] })),
    [commit],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => commit((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [commit],
  );

  const setConnection = useCallback(
    (channel: Channel, patch: Partial<Connection>) =>
      commit((s) => ({
        ...s,
        connections: { ...s.connections, [channel]: { ...s.connections[channel], ...patch } },
      })),
    [commit],
  );

  const patchConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) =>
      commit((s) => ({
        ...s,
        conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)),
      })),
    [commit],
  );

  const translateClientMessage = useCallback(
    async (conversationId: string, messageId: string) => {
      const conv = ref.current.conversations.find((c) => c.id === conversationId);
      const msg = conv?.messages.find((m) => m.id === messageId);
      if (!conv || !msg || msg.es) return Boolean(msg?.es);
      const recent = conv.messages
        .filter((m) => m.id !== messageId)
        .slice(-4)
        .map((m) => ({
          from: m.from === "client" ? ("client" as const) : ("user" as const),
          text: m.es ?? m.text,
        }));
      const res = await translate({
        text: msg.text,
        to: "es",
        trade: ref.current.profile.trade,
        recent,
      });
      if (!res.ok) return false;
      patchConversation(conversationId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, es: res.text } : m)),
      }));
      return true;
    },
    [patchConversation],
  );

  const receiveClientMessage = useCallback(
    (input: Parameters<Store["receiveClientMessage"]>[0]) => {
      const s = ref.current;
      const text = input.text.slice(0, 1000); // client text is untrusted input
      const existing =
        s.conversations.find((c) => c.id === input.conversationId) ??
        s.conversations.find(
          (c) =>
            digits(c.phone) !== "" &&
            digits(c.phone) === digits(input.phone) &&
            c.channel === input.channel,
        );
      const id = existing?.id ?? uid();
      const knownClient = s.clients.find(
        (c) => digits(c.phone) !== "" && digits(c.phone) === digits(input.phone),
      );
      const message: InboxMessage = {
        id: uid(),
        from: "client",
        text,
        photo: input.photo,
        at: nowISO(),
      };
      const conv: Conversation = existing
        ? {
            ...existing,
            messages: [...existing.messages, message],
            unread: true,
            updatedAt: nowISO(),
          }
        : {
            id,
            channel: input.channel,
            contactName: knownClient?.name ?? input.contactName,
            phone: input.phone,
            clientId: knownClient?.id,
            address: knownClient?.address || undefined,
            lang: detectLang(text),
            stage: "nuevo",
            messages: [message],
            unread: true,
            updatedAt: nowISO(),
          };
      commit((prev) => ({
        ...prev,
        conversations: existing
          ? prev.conversations.map((c) => (c.id === id ? conv : c))
          : [conv, ...prev.conversations],
      }));

      // English from the client is translated right away so the user always reads Spanish.
      if (detectLang(text) === "en" && !input.photo) void translateClientMessage(id, message.id);

      const quiet = conv.stage === "tu_turno" || conv.stage === "manual";
      if (!s.settings.autoReply || quiet) return id;

      setTypingIn((t) => [...t, id]);
      window.setTimeout(() => {
        setTypingIn((t) => t.filter((x) => x !== id));
        const latest = ref.current.conversations.find((c) => c.id === id) ?? conv;
        run((st) =>
          ops.applyResult(st, id, runAutopilot(st, latest, text, { photo: input.photo })),
        );
      }, 1100);
      return id;
    },
    [commit, run, translateClientMessage],
  );

  const sendUserMessage = useCallback(
    (conversationId: string, text: string, es?: string) =>
      // Once the user writes by hand, Marcelo stays quiet in this chat until reactivated.
      patchConversation(conversationId, (c) => ({
        ...c,
        stage: "manual",
        messages: [...c.messages, { id: uid(), from: "user", text, es, at: nowISO() }],
        updatedAt: nowISO(),
      })),
    [patchConversation],
  );

  const moveJobTo = useCallback(
    (jobId: string, date: string, time: string, notify: boolean) => {
      commit((s) => ops.moveJob(s, jobId, date, time));
      if (notify) run((s) => ops.queueJobMessage(s, "confirm", jobId, { force: "ask" }));
    },
    [commit, run],
  );

  const dismissMove = useCallback(
    (conversationId: string, key: string) =>
      patchConversation(conversationId, (c) => ({ ...c, dismissedMove: key })),
    [patchConversation],
  );

  const sendPrepared = useCallback(
    (conversationId: string, result: AutopilotResult) =>
      run((s) => ops.applyResult(s, conversationId, result)),
    [run],
  );

  const setConversationStage = useCallback(
    (conversationId: string, stage: Conversation["stage"]) =>
      patchConversation(conversationId, (c) => ({ ...c, stage })),
    [patchConversation],
  );

  const markConversationRead = useCallback(
    (conversationId: string) =>
      patchConversation(conversationId, (c) => (c.unread ? { ...c, unread: false } : c)),
    [patchConversation],
  );

  const reset = useCallback(() => commit(() => demoState()), [commit]);

  const value = useMemo<Store>(
    () => ({
      state,
      ready,
      setProfile,
      addClient,
      updateClient,
      addJob,
      updateJob,
      removeJob,
      finishJob,
      startTrip,
      queueJobMessage,
      sendOutbox,
      dismissOutbox,
      addExpense,
      updateExpense,
      removeExpense,
      restoreExpense,
      recordPayment,
      addReceivable,
      addMiles,
      removeMiles,
      addPending,
      togglePending,
      removePending,
      restorePending,
      clearDonePendings,
      addMessage,
      addService,
      updateService,
      removeService,
      restoreService,
      setSettings,
      setConnection,
      receiveClientMessage,
      sendUserMessage,
      sendPrepared,
      translateClientMessage,
      moveJobTo,
      dismissMove,
      setConversationStage,
      markConversationRead,
      typingIn,
      reset,
      clientById: (id?: string) => state.clients.find((c) => c.id === id),
      findClientByName: (name: string) => {
        const n = name.trim().toLowerCase();
        if (!n) return undefined;
        return (
          state.clients.find((c) => c.name.toLowerCase() === n) ??
          state.clients.find(
            (c) =>
              c.name.toLowerCase().includes(n) ||
              n.includes((c.name.split(" ")[0] ?? "").toLowerCase()),
          )
        );
      },
    }),
    [
      state,
      ready,
      setProfile,
      addClient,
      updateClient,
      addJob,
      updateJob,
      removeJob,
      finishJob,
      startTrip,
      queueJobMessage,
      sendOutbox,
      dismissOutbox,
      addExpense,
      updateExpense,
      removeExpense,
      restoreExpense,
      recordPayment,
      addReceivable,
      addMiles,
      removeMiles,
      addPending,
      togglePending,
      removePending,
      restorePending,
      clearDonePendings,
      addMessage,
      addService,
      updateService,
      removeService,
      restoreService,
      setSettings,
      setConnection,
      receiveClientMessage,
      sendUserMessage,
      sendPrepared,
      translateClientMessage,
      moveJobTo,
      dismissMove,
      setConversationStage,
      markConversationRead,
      typingIn,
      reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarcelo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMarcelo must be used inside MarceloProvider");
  return ctx;
}

export function useMoney() {
  const { state } = useMarcelo();
  const month = monthISO();
  const income = state.payments
    .filter((p) => p.date.startsWith(month))
    .reduce((a, b) => a + b.amount, 0);
  const spent = state.expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((a, b) => a + b.amount, 0);
  const owed = state.receivables.filter((r) => !r.paidAt).reduce((a, b) => a + b.amount, 0);
  return { income, spent, profit: income - spent, owed };
}
