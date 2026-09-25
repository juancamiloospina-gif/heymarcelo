import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  demoState,
  todayISO,
  uid,
  type Client,
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
  addMessage: (m: Omit<Message, "id">) => Message;
  reset: () => void;
  clientById: (id?: string) => Client | undefined;
  findClientByName: (name: string) => Client | undefined;
};

const Ctx = createContext<Store | null>(null);

export function MarceloProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarceloState>(() => demoState());
  const [ready, setReady] = useState(false);

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
    setState((s) => ({ ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
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

  const addMessage = useCallback((m: Omit<Message, "id">) => {
    const message: Message = { ...m, id: uid() };
    setState((s) => ({ ...s, messages: [message, ...s.messages] }));
    return message;
  }, []);

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
      addMessage,
      reset,
      clientById: (id?: string) => state.clients.find((c) => c.id === id),
      findClientByName: (name: string) => {
        const n = name.trim().toLowerCase();
        if (!n) return undefined;
        return (
          state.clients.find((c) => c.name.toLowerCase() === n) ??
          state.clients.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.split(" ")[0].toLowerCase()))
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
      addMessage,
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
  const month = new Date().toISOString().slice(0, 7);
  const income = state.payments
    .filter((p) => p.date.startsWith(month) && p.method !== "debe")
    .reduce((a, b) => a + b.amount, 0);
  const spent = state.expenses.filter((e) => e.date.startsWith(month)).reduce((a, b) => a + b.amount, 0);
  const owed = state.pendings
    .filter((p) => !p.done && typeof p.amount === "number")
    .reduce((a, b) => a + (b.amount ?? 0), 0);
  return { income, spent, profit: income - spent, owed };
}
