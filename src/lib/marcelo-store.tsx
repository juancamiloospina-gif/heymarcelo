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
import {
  detectLang,
  offerPrice as buildOffer,
  runAutopilot,
  type AutopilotResult,
} from "./marcelo-autopilot";
import {
  demoState,
  digits,
  monthISO,
  nowISO,
  prettyDate,
  prettyTime,
  todayISO,
  uid,
  type Channel,
  type Client,
  type Connection,
  type Conversation,
  type InboxMessage,
  type Service,
  type Settings,
  type Expense,
  type Job,
  type MarceloState,
  type Message,
  type Payment,
  type Pending,
  type Profile,
} from "./marcelo-data";

const KEY = "marcelo.state.v1";

type Store = {
  state: MarceloState;
  ready: boolean;
  setProfile: (p: Partial<Profile>) => void;
  addClient: (c: Omit<Client, "id">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  addJob: (j: Omit<Job, "id">) => Job;
  updateJob: (id: string, patch: Partial<Job>) => void;
  addExpense: (e: Omit<Expense, "id">) => Expense;
  addPayment: (p: Omit<Payment, "id">) => Payment;
  addPending: (text: string, extra?: Partial<Pending>) => Pending;
  togglePending: (id: string) => void;
  removeExpense: (id: string) => void;
  clearDonePendings: () => void;
  addMessage: (m: Omit<Message, "id">) => Message;
  addService: (s: Omit<Service, "id">) => void;
  updateService: (id: string, patch: Partial<Service>) => void;
  removeService: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setConnection: (channel: Channel, patch: Partial<Connection>) => void;
  receiveClientMessage: (input: {
    conversationId?: string;
    channel: Channel;
    contactName: string;
    phone: string;
    text: string;
  }) => string;
  sendUserMessage: (conversationId: string, text: string, es?: string) => void;
  offerPrice: (conversationId: string, price: number) => void;
  setConversationStage: (conversationId: string, stage: Conversation["stage"]) => void;
  markConversationRead: (conversationId: string) => void;
  typingIn: string[];
  reset: () => void;
  clientById: (id?: string) => Client | undefined;
  findClientByName: (name: string) => Client | undefined;
};

const Ctx = createContext<Store | null>(null);

export function MarceloProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarceloState>(() => demoState());
  const [ready, setReady] = useState(false);
  const [typingIn, setTypingIn] = useState<string[]>([]);
  // Autopilot replies run after a short delay and must see the latest state.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setState({ ...demoState(), ...(JSON.parse(raw) as MarceloState) });
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

  const setProfile = useCallback((p: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  }, []);

  const addClient = useCallback((c: Omit<Client, "id">) => {
    const client: Client = { ...c, id: uid() };
    setState((s) => ({ ...s, clients: [...s.clients, client] }));
    return client;
  }, []);

  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const addJob = useCallback((j: Omit<Job, "id">) => {
    const job: Job = { ...j, id: uid() };
    setState((s) => ({ ...s, jobs: [...s.jobs, job] }));
    return job;
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
  }, []);

  const addExpense = useCallback((e: Omit<Expense, "id">) => {
    const expense: Expense = { ...e, id: uid() };
    setState((s) => ({ ...s, expenses: [expense, ...s.expenses] }));
    return expense;
  }, []);

  const addPayment = useCallback((p: Omit<Payment, "id">) => {
    const payment: Payment = { ...p, id: uid() };
    setState((s) => ({ ...s, payments: [payment, ...s.payments] }));
    return payment;
  }, []);

  const addPending = useCallback((text: string, extra?: Partial<Pending>) => {
    const pending: Pending = { id: uid(), text, done: false, createdAt: todayISO(), ...extra };
    setState((s) => ({ ...s, pendings: [pending, ...s.pendings] }));
    return pending;
  }, []);

  const togglePending = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      pendings: s.pendings.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    }));
  }, []);

  const removeExpense = useCallback((id: string) => {
    setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
  }, []);

  const clearDonePendings = useCallback(() => {
    setState((s) => ({ ...s, pendings: s.pendings.filter((p) => !p.done) }));
  }, []);

  const addMessage = useCallback((m: Omit<Message, "id">) => {
    const message: Message = { ...m, id: uid() };
    setState((s) => ({ ...s, messages: [message, ...s.messages] }));
    return message;
  }, []);

  const addService = useCallback((svc: Omit<Service, "id">) => {
    setState((s) => ({ ...s, services: [...s.services, { ...svc, id: uid() }] }));
  }, []);

  const updateService = useCallback((id: string, patch: Partial<Service>) => {
    setState((s) => ({
      ...s,
      services: s.services.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const removeService = useCallback((id: string) => {
    setState((s) => ({ ...s, services: s.services.filter((x) => x.id !== id) }));
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const setConnection = useCallback((channel: Channel, patch: Partial<Connection>) => {
    setState((s) => ({
      ...s,
      connections: { ...s.connections, [channel]: { ...s.connections[channel], ...patch } },
    }));
  }, []);

  const patchConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) =>
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)),
      })),
    [],
  );

  /** Applies an autopilot result: reply, conversation patch, booking, address and follow-ups. */
  const applyResult = useCallback((conversationId: string, result: AutopilotResult) => {
    const s = stateRef.current;
    const conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    let clientId = conv.clientId;
    let newClient: Client | undefined;
    let job: Job | undefined;
    if (result.book) {
      if (!clientId) {
        newClient = {
          id: uid(),
          name: conv.contactName,
          phone: conv.phone,
          address: "",
          city: s.profile.city,
          service: result.book.service.name,
          price: result.book.price,
        };
        clientId = newClient.id;
      }
      job = {
        id: uid(),
        clientId,
        date: result.book.date,
        time: result.book.time,
        service: result.book.service.name,
        price: result.book.price,
        status: "confirmado",
      };
    }
    const reply: InboxMessage | undefined = result.reply
      ? { id: uid(), from: "marcelo", text: result.reply.text, es: result.reply.es, at: nowISO() }
      : undefined;

    setState((prev) => ({
      ...prev,
      clients: [
        ...prev.clients.map((c) =>
          c.id === clientId && result.saveAddress ? { ...c, address: result.saveAddress } : c,
        ),
        ...(newClient ? [newClient] : []),
      ],
      jobs: job ? [...prev.jobs, job] : prev.jobs,
      pendings: result.pending
        ? [
            {
              id: uid(),
              text: result.pending.text,
              clientId,
              amount: result.pending.amount,
              done: false,
              createdAt: todayISO(),
            },
            ...prev.pendings,
          ]
        : prev.pendings,
      conversations: prev.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = [...c.messages];
        const last = messages[messages.length - 1];
        if (result.clientNote && last?.from === "client") {
          messages[messages.length - 1] = { ...last, note: result.clientNote };
        }
        if (reply) messages.push(reply);
        return {
          ...c,
          ...result.patch,
          clientId,
          jobId: job?.id ?? c.jobId,
          messages,
          unread: true,
          updatedAt: nowISO(),
        };
      }),
    }));

    const first = conv.contactName.split(" ")[0];
    if (result.event === "booked" && result.book) {
      toast.success(`Marcelo agendó a ${first}`, {
        description: `${result.book.service.name} · ${prettyDate(result.book.date)}, ${prettyTime(result.book.time)}`,
      });
    } else if (result.event === "handoff") {
      toast(`${first} necesita tu respuesta`, { description: result.clientNote });
    }
  }, []);

  const receiveClientMessage = useCallback(
    (input: {
      conversationId?: string;
      channel: Channel;
      contactName: string;
      phone: string;
      text: string;
    }) => {
      const s = stateRef.current;
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
      const message: InboxMessage = { id: uid(), from: "client", text: input.text, at: nowISO() };
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
            lang: detectLang(input.text),
            stage: "nuevo",
            messages: [message],
            unread: true,
            updatedAt: nowISO(),
          };
      setState((prev) => ({
        ...prev,
        conversations: existing
          ? prev.conversations.map((c) => (c.id === id ? conv : c))
          : [conv, ...prev.conversations],
      }));

      const quiet = conv.stage === "tu_turno" || conv.stage === "manual";
      if (!s.settings.autoReply || quiet) return id;

      setTypingIn((t) => [...t, id]);
      window.setTimeout(() => {
        setTypingIn((t) => t.filter((x) => x !== id));
        const latest = stateRef.current.conversations.find((c) => c.id === id) ?? conv;
        applyResult(id, runAutopilot(stateRef.current, latest, input.text));
      }, 1100);
      return id;
    },
    [applyResult],
  );

  const sendUserMessage = useCallback(
    (conversationId: string, text: string, es?: string) => {
      // Once the user writes by hand, Marcelo stays quiet in this chat until handed back.
      patchConversation(conversationId, (c) => ({
        ...c,
        stage: c.stage === "agendado" ? c.stage : "manual",
        messages: [...c.messages, { id: uid(), from: "user", text, es, at: nowISO() }],
        updatedAt: nowISO(),
      }));
    },
    [patchConversation],
  );

  const offerPrice = useCallback(
    (conversationId: string, price: number) => {
      const s = stateRef.current;
      const conv = s.conversations.find((c) => c.id === conversationId);
      const service = s.services.find((x) => x.id === conv?.serviceId);
      if (!conv || !service) return;
      applyResult(conversationId, buildOffer(s, conv, service, price));
    },
    [applyResult],
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

  const reset = useCallback(() => setState(demoState()), []);

  const value = useMemo<Store>(
    () => ({
      state,
      ready,
      setProfile,
      addClient,
      updateClient,
      addJob,
      updateJob,
      addExpense,
      addPayment,
      addPending,
      togglePending,
      removeExpense,
      clearDonePendings,
      addMessage,
      addService,
      updateService,
      removeService,
      setSettings,
      setConnection,
      receiveClientMessage,
      sendUserMessage,
      offerPrice,
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
      addExpense,
      addPayment,
      addPending,
      togglePending,
      removeExpense,
      clearDonePendings,
      addMessage,
      addService,
      updateService,
      removeService,
      setSettings,
      setConnection,
      receiveClientMessage,
      sendUserMessage,
      offerPrice,
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
    .filter((p) => p.date.startsWith(month) && p.method !== "debe")
    .reduce((a, b) => a + b.amount, 0);
  const spent = state.expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((a, b) => a + b.amount, 0);
  const owed = state.pendings
    .filter((p) => !p.done && typeof p.amount === "number")
    .reduce((a, b) => a + (b.amount ?? 0), 0);
  return { income, spent, profit: income - spent, owed };
}
