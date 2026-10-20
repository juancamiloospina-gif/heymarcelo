import { TaxCard } from "@/components/marcelo/tax-card";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  CalendarDays,
  Check,
  Equal,
  MessageSquare,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  FileText,
  HandCoins,
  Loader2,
  Mic,
  Navigation,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Chips,
  Empty,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
  Sheet,
  Tabs,
} from "@/components/marcelo/kit";
import { PaymentSheet } from "@/components/marcelo/jobs";
import { MascotAvatar } from "@/components/marcelo/mascot";
import character from "@/assets/marcelo-character.png";
import accountant from "@/assets/marcelo-character-contador.png";
import { Swipeable } from "@/components/marcelo/reminders";
import { ClientAvatar, IconChip, expenseVisual, toneChip } from "@/components/marcelo/visual";
import { useMarcelo, useMoney } from "@/lib/marcelo-store";
import {
  daysBetween,
  expenseCategories,
  money,
  monthISO,
  paymentMethodLabel,
  prettyDate,
  signedMoney,
  todayISO,
  type Expense,
  type ExpenseCategory,
  type Receivable,
} from "@/lib/marcelo-data";
import { parseSpokenExpense, readReceipt } from "@/lib/ai/receipt";
import { accountantGroup, downloadSummaryPdf, sendToAccountant, yearNumbers } from "@/lib/reports";
import { canDictate, dictate } from "@/lib/speech";
import { cn } from "@/lib/utils";

type Tab = "resumen" | "cobrar" | "gastos" | "contador";
const TABS = ["resumen", "cobrar", "gastos", "contador"] as const;

export const Route = createFileRoute("/dinero")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {},
  head: () => ({
    meta: [
      { title: "Dinero — Marcelo" },
      {
        name: "description",
        content: "Ganancia, por cobrar, gastos y el resumen para tu contador.",
      },
    ],
  }),
  component: Dinero,
});

function Dinero() {
  const { tab = "resumen" } = Route.useSearch();
  const navigate = useNavigate();
  const { state } = useMarcelo();
  const owedCount = state.receivables.filter((r) => !r.paidAt).length;
  const setTab = (t: Tab) => navigate({ to: "/dinero", search: { tab: t }, replace: true });

  return (
    <Screen>
      <PageTitle title="Dinero" right={<MascotAvatar />} />
      <Tabs
        tabs={[
          { key: "resumen", label: "Resumen" },
          { key: "cobrar", label: "Por cobrar", badge: owedCount },
          { key: "gastos", label: "Gastos" },
          { key: "contador", label: "Contador" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "resumen" ? <Resumen onTab={setTab} /> : null}
      {tab === "cobrar" ? <PorCobrar /> : null}
      {tab === "gastos" ? <Gastos /> : null}
      {tab === "contador" ? <Contador onTab={setTab} /> : null}
    </Screen>
  );
}

function Resumen({ onTab }: { onTab: (t: Tab) => void }) {
  const { state, clientById } = useMarcelo();
  const { income, spent, profit, owed } = useMoney();
  const [paying, setPaying] = useState(false);
  const month = monthISO();
  const miles = state.miles
    .filter((m) => m.date.startsWith(month))
    .reduce((a, b) => a + b.miles, 0);
  const movements = [
    ...state.payments.map((p) => ({
      id: p.id,
      date: p.date,
      label: `Pago de ${clientById(p.clientId)?.name ?? "cliente"}`,
      detail: paymentMethodLabel[p.method],
      amount: p.amount,
      category: undefined as ExpenseCategory | undefined,
    })),
    ...state.expenses.map((e) => ({
      id: e.id,
      date: e.date,
      label: e.store ?? e.category,
      detail: e.category,
      amount: -e.amount,
      category: e.category as ExpenseCategory | undefined,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <>
      <Card className="relative overflow-hidden rounded-[1.5rem] border-0 bg-primary p-5 text-primary-foreground">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10"
        />
        <p className="relative text-[13px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/70">
          Este mes
        </p>
        <p className="relative mt-2 text-[40px] font-extrabold leading-none">
          {signedMoney(profit)}
        </p>
        <p className="relative mt-1 text-[16px] text-primary-foreground/80">Ganancia</p>
        <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-primary-foreground/20 pt-4">
          <div className="flex items-center gap-3">
            <CircleDollarSign
              className="size-7 shrink-0 text-primary-foreground/80"
              strokeWidth={1.6}
            />
            <div>
              <p className="text-[14px] text-primary-foreground/70">Cobrado</p>
              <p className="text-[20px] font-bold">{money(income)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-primary-foreground/20 pl-4">
            <CreditCard className="size-7 shrink-0 text-primary-foreground/80" strokeWidth={1.6} />
            <div>
              <p className="text-[14px] text-primary-foreground/70">Gastos</p>
              <p className="text-[20px] font-bold">{money(spent)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          className="rounded-full px-3 shadow-[var(--shadow-card)]"
          onClick={() => setPaying(true)}
        >
          <Wallet className="size-5" /> Cobré
        </Button>
        <Button
          variant="secondary"
          className="whitespace-nowrap rounded-full border-border/60 px-3 shadow-[var(--shadow-card)]"
          onClick={() => onTab("gastos")}
        >
          <Plus className="size-5 text-accent" strokeWidth={2.4} /> Anotar gasto
        </Button>
      </div>

      {owed > 0 ? (
        <Card
          className="mt-3 flex items-center gap-3 rounded-[1.25rem]"
          onClick={() => onTab("cobrar")}
        >
          <IconChip icon={HandCoins} tone="accent" className="size-12 rounded-full bg-peach" />
          <p className="flex-1 text-[17px] font-bold">Por cobrar: {money(owed)}</p>
          <span className="flex items-center text-[15px] font-bold text-accent">
            Ver <ChevronRight className="size-4" />
          </span>
        </Card>
      ) : null}
      {miles > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[15px] text-muted-foreground">
          <Navigation className="size-4" /> {miles.toFixed(1)} millas registradas este mes
        </p>
      ) : null}

      <SectionTitle>Últimos movimientos</SectionTitle>
      {movements.length === 0 ? (
        <Empty title="Nada por aquí." hint="Tus cobros y gastos aparecen aquí." />
      ) : (
        <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
          {movements.map((m) => (
            <div key={m.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
              {m.category ? (
                <IconChip
                  icon={expenseVisual[m.category].icon}
                  tone={expenseVisual[m.category].tone}
                  className="size-11 rounded-full"
                />
              ) : (
                <IconChip icon={ArrowDownLeft} tone="success" className="size-11 rounded-full" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{m.label}</span>
                <span className="block truncate text-[14px] text-muted-foreground">
                  {prettyDate(m.date)} · {m.detail}
                </span>
              </span>
              <span className={cn("text-[16px] font-semibold", m.amount > 0 && "text-success")}>
                {m.amount > 0 ? "+" : "−"}
                {money(m.amount)}
              </span>
            </div>
          ))}
        </Card>
      )}
      {paying ? <PaymentSheet onClose={() => setPaying(false)} /> : null}
    </>
  );
}

/** Marcelo's character with a short tip, the closing card of Por cobrar and Gastos. */
function MarceloTip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex items-end gap-3 overflow-hidden rounded-[1.25rem] border border-accent/15 bg-peach pl-2 pr-4">
      <img
        src={character}
        alt=""
        aria-hidden
        className="-mb-3 size-[92px] shrink-0 object-contain"
      />
      <p className="self-center py-4 text-[15px] font-semibold leading-snug">{children}</p>
    </div>
  );
}

const Eyebrow = ({ children, dot }: { children: ReactNode; dot?: boolean }) => (
  <h2 className="mb-3 mt-7 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-foreground">
    {dot ? <span className="size-2 rounded-full bg-accent" /> : null}
    {children}
  </h2>
);

function DebtCard({ r, onPay }: { r: Receivable; onPay: () => void }) {
  const { state, clientById, queueJobMessage } = useMarcelo();
  const navigate = useNavigate();
  const client = clientById(r.clientId);
  const job = state.jobs.find((j) => j.id === r.jobId);
  const conv = state.conversations.find((c) => c.clientId === r.clientId);
  const days = daysBetween(r.createdAt, todayISO());
  const late = days >= 7;
  return (
    <Card className="rounded-[1.25rem] p-4">
      <div className="flex items-start gap-3">
        <ClientAvatar name={client?.name ?? "?"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-extrabold">{client?.name ?? "Cliente"}</p>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold",
              late ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
            )}
          >
            <Clock className="size-3.5" />
            {days === 0 ? "Hoy" : `Hace ${days} ${days === 1 ? "día" : "días"}`}
          </span>
          <p className="mt-1.5 truncate text-[14px] text-muted-foreground">
            {r.note ?? "Sin detalle"} · {prettyDate(r.createdAt)}
          </p>
        </div>
        <p className="text-[26px] font-extrabold leading-none">{money(r.amount)}</p>
      </div>
      <div className={cn("mt-4 grid gap-2", job ? "grid-cols-2" : "grid-cols-1")}>
        {job ? (
          <button
            onClick={() => queueJobMessage("invoice", job.id, "ask")}
            className="flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-2xl bg-primary px-2 text-[14px] font-bold text-primary-foreground transition-transform active:scale-95"
          >
            <MessageSquare className="size-4 shrink-0" /> Enviar recordatorio
          </button>
        ) : null}
        <button
          onClick={onPay}
          className="flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-2xl border-2 border-sky px-2 text-[14px] font-bold text-sky transition-transform active:scale-95"
        >
          <CheckCircle2 className="size-4 shrink-0" /> Marcar cobrado
        </button>
      </div>
      {conv ? (
        <button
          onClick={() =>
            navigate({ to: "/bandeja/$conversationId", params: { conversationId: conv.id } })
          }
          className="mt-3 flex min-h-12 w-full items-center gap-3 border-t pt-3 text-left text-[15px] font-semibold"
        >
          <MessageSquare className="size-5 text-muted-foreground" />
          <span className="flex-1">Ver conversación</span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </button>
      ) : null}
    </Card>
  );
}

function PorCobrar() {
  const { state, clientById, addReceivable } = useMarcelo();
  const navigate = useNavigate();
  const [paying, setPaying] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ clientId: "", amount: "", note: "" });
  const open = state.receivables
    .filter((r) => !r.paidAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [first, ...rest] = open;
  const paid = state.receivables.filter((r) => r.paidAt).slice(0, 8);
  const total = open.reduce((a, b) => a + b.amount, 0);
  const people = new Set(open.map((r) => r.clientId)).size;

  return (
    <>
      <Card className="flex items-center gap-3 rounded-[1.25rem] border-accent/20 bg-peach p-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <HandCoins className="size-7" strokeWidth={1.6} />
        </span>
        <span className="h-14 w-px shrink-0 bg-accent/20" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-accent">Por cobrar</p>
          <p className="text-[30px] font-extrabold leading-none">{money(total)}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {people} {people === 1 ? "cliente pendiente" : "clientes pendientes"}
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex h-11 shrink-0 items-center gap-1 rounded-full border-2 border-sky bg-card px-3.5 text-[15px] font-bold text-sky"
        >
          <Plus className="size-5" /> Agregar
        </button>
      </Card>

      {adding ? (
        <Card className="mt-3 space-y-3 rounded-[1.25rem]">
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
              Cliente
            </span>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px] outline-none focus:border-accent"
            >
              <option value="">Elige un cliente</option>
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Monto"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <Field
              label="Por qué"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <Button
            className="w-full"
            disabled={!form.clientId || !(Number(form.amount) > 0)}
            onClick={() => {
              addReceivable({
                clientId: form.clientId,
                amount: Number(form.amount),
                note: form.note || undefined,
              });
              setForm({ clientId: "", amount: "", note: "" });
              setAdding(false);
              toast.success("Anotado en Por cobrar");
            }}
          >
            Guardar
          </Button>
        </Card>
      ) : null}

      {!first ? (
        <div className="mt-5">
          <Empty
            title="Nadie te debe."
            hint="Cuando un cliente no pague al terminar, aparece aquí."
          />
        </div>
      ) : (
        <>
          <Eyebrow dot>Cobra hoy</Eyebrow>
          <DebtCard r={first} onPay={() => setPaying(first.id)} />
          <MarceloTip>
            Un recordatorio amable suele funcionar. Marcelo lo escribe por ti.
          </MarceloTip>
          {rest.length ? (
            <>
              <Eyebrow>También te deben</Eyebrow>
              <div className="space-y-3">
                {rest.map((r) => (
                  <DebtCard key={r.id} r={r} onPay={() => setPaying(r.id)} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {paid.length ? (
        <>
          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Historial
          </h2>
          <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
            {paid.map((r) => (
              <button
                key={r.id}
                onClick={() =>
                  navigate({ to: "/clientes/$clientId", params: { clientId: r.clientId } })
                }
                className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                  <Check className="size-6" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-extrabold">
                    {clientById(r.clientId)?.name ?? "Cliente"}
                  </span>
                  <span className="block truncate text-[14px] text-muted-foreground">
                    {money(r.amount)} · Cobrado el {r.paidAt ? prettyDate(r.paidAt) : ""}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
              </button>
            ))}
          </Card>
        </>
      ) : null}
      {paying ? <PaymentSheet receivableId={paying} onClose={() => setPaying(null)} /> : null}
    </>
  );
}

const emptyForm = {
  amount: "",
  category: null as ExpenseCategory | null,
  store: "",
  note: "",
  date: todayISO(),
  receipt: undefined as string | undefined,
};

const monthLabel = () => {
  const s = new Date().toLocaleDateString("es-US", { month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function Gastos() {
  const { state, addExpense, updateExpense, removeExpense, restoreExpense } = useMarcelo();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [reading, setReading] = useState(false);
  const [listening, setListening] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const month = monthISO();
  const monthExpenses = state.expenses.filter((e) => e.date.startsWith(month));
  const total = monthExpenses.reduce((a, b) => a + b.amount, 0);
  // Four bars: spending in days 1–7, 8–14, 15–21 and 22 onwards of this month.
  const weeks = [0, 1, 2, 3].map((w) =>
    monthExpenses
      .filter((e) => Math.min(3, Math.floor((Number(e.date.slice(8, 10)) - 1) / 7)) === w)
      .reduce((a, b) => a + b.amount, 0),
  );
  const maxWeek = Math.max(...weeks, 1);
  const amount = Number(form.amount.replace(/[$,\s]/g, ""));
  const canSave = amount > 0 && form.category !== null;

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm({ ...emptyForm, date: todayISO() });
    setSuggested(false);
  };

  const onPhoto = (file: File) => {
    setFormOpen(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const receipt = String(reader.result);
      setForm((f) => ({ ...f, receipt }));
      setReading(true);
      const res = await readReceipt(receipt);
      setReading(false);
      if (!res.ok) {
        toast.error(res.reply);
        return;
      }
      const r = res.read;
      setForm((f) => ({
        ...f,
        amount: r.amount ? String(r.amount) : f.amount,
        date: r.date && r.date <= todayISO() ? r.date : f.date,
        store: r.store ?? f.store,
        category: r.category ?? f.category,
      }));
      setSuggested(Boolean(r.category));
      toast.success(r.amount ? "Recibo leído. Revisa y guarda." : "No vi el total. Escríbelo tú.");
    };
    reader.readAsDataURL(file);
  };

  const speakExpense = () => {
    if (!canDictate()) {
      toast.info("Este navegador no permite dictado. Escribe el gasto.");
      setFormOpen(true);
      return;
    }
    setListening(true);
    dictate("es", {
      onText: () => {},
      onFinal: (t) => {
        const r = parseSpokenExpense(t);
        setForm((f) => ({
          ...f,
          amount: r.amount ? String(r.amount) : f.amount,
          category: r.category ?? f.category,
          note: t,
        }));
        setSuggested(Boolean(r.category));
        setListening(false);
        setFormOpen(true);
      },
      onError: () => {
        setListening(false);
        toast.error("No te escuché bien. Intenta de nuevo.");
      },
      onEnd: () => setListening(false),
    });
  };

  const save = () => {
    if (!canSave) return;
    const data = {
      amount,
      category: form.category!,
      store: form.store.trim() || undefined,
      note: form.note.trim() || undefined,
      date: form.date || todayISO(),
      receipt: form.receipt,
    };
    if (editing) {
      updateExpense(editing, data);
      toast.success("Gasto actualizado");
    } else {
      addExpense(data);
      toast.success(`Gasto guardado: ${money(amount)}`);
    }
    closeForm();
  };

  const edit = (e: Expense) => {
    setEditing(e.id);
    setForm({
      amount: String(e.amount),
      category: e.category,
      store: e.store ?? "",
      note: e.note ?? "",
      date: e.date,
      receipt: e.receipt,
    });
    setFormOpen(true);
  };

  const remove = (id: string) => {
    const removed = removeExpense(id);
    if (removed)
      toast("Gasto borrado", {
        action: { label: "Deshacer", onClick: () => restoreExpense(removed) },
      });
  };

  const rows = showAll ? state.expenses.slice(0, 50) : state.expenses.slice(0, 5);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPhoto(f);
          e.target.value = "";
        }}
      />

      <Card className="flex items-center gap-4 rounded-[1.25rem] p-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Wallet className="size-7" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Gastos de {monthLabel().toLowerCase()}</p>
          <p className="text-[32px] font-extrabold leading-none">{money(total)}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {monthExpenses.length} {monthExpenses.length === 1 ? "movimiento" : "movimientos"}
          </p>
        </div>
        <div className="flex h-16 shrink-0 items-end gap-1.5" aria-hidden>
          {weeks.map((w, i) => (
            <span
              key={i}
              style={{ height: `${Math.max(14, (w / maxWeek) * 100)}%` }}
              className={cn(
                "w-3.5 rounded-t-md",
                w === Math.max(...weeks) && w > 0 ? "bg-accent" : "bg-brand-soft",
              )}
            />
          ))}
        </div>
      </Card>

      <h2 className="mb-3 mt-6 text-[20px] font-extrabold">Registra un gasto</h2>
      <Button
        className="h-14 w-full rounded-full text-[17px] shadow-[var(--shadow-card)]"
        onClick={() => {
          setEditing(null);
          setForm({ ...emptyForm, date: todayISO() });
          setFormOpen(true);
        }}
      >
        <Plus className="size-6" /> Agregar gasto
      </Button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={reading}
          className="flex h-14 min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-2 text-[15px] font-bold shadow-[var(--shadow-card)] transition-transform active:scale-95 disabled:opacity-60"
        >
          {reading ? (
            <Loader2 className="size-5 animate-spin text-sky" />
          ) : (
            <Camera className="size-5 shrink-0 text-sky" />
          )}
          Foto del recibo
        </button>
        <button
          onClick={speakExpense}
          aria-label="Dictar gasto"
          className="flex h-14 min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-2 text-[15px] font-bold shadow-[var(--shadow-card)] transition-transform active:scale-95"
        >
          <Mic
            className={cn("size-5 shrink-0 text-sky", listening && "animate-pulse text-accent")}
          />
          Díselo a Marcelo
        </button>
      </div>

      <Card className="mt-5 rounded-[1.25rem] p-0">
        <p className="px-4 pb-1 pt-4 text-[18px] font-extrabold">Últimos gastos</p>
        {state.expenses.length === 0 ? (
          <p className="px-4 pb-5 pt-1 text-[15px] text-muted-foreground">
            Sin gastos todavía. Toma una foto del recibo y Marcelo lo anota.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((e) => (
              <Swipeable key={e.id} onLeft={() => remove(e.id)}>
                <button
                  onClick={() => edit(e)}
                  className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <IconChip
                    icon={expenseVisual[e.category].icon}
                    tone={expenseVisual[e.category].tone}
                    className="size-12 rounded-full"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-extrabold">
                      {e.store ?? e.category}
                    </span>
                    <span className="block truncate text-[14px] text-muted-foreground">
                      {e.store ? `${e.category} · ` : ""}
                      {prettyDate(e.date)}
                      {e.receipt ? " · con recibo" : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[17px] font-bold text-destructive">
                    −{money(e.amount)}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
                </button>
              </Swipeable>
            ))}
          </div>
        )}
        {state.expenses.length > 5 ? (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="h-12 w-full border-t text-[15px] font-bold text-sky"
          >
            {showAll ? "Ver menos" : `Ver todos (${state.expenses.length})`}
          </button>
        ) : null}
      </Card>

      <MarceloTip>Una foto del recibo basta. Marcelo organiza el resto.</MarceloTip>

      {formOpen ? (
        <Sheet
          title={editing ? "Editar gasto" : "Agregar gasto"}
          icon={<Wallet className="size-5 text-accent" />}
          onClose={closeForm}
        >
          <div className="space-y-4">
            {!editing ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={reading}
                  onClick={() => fileRef.current?.click()}
                >
                  {reading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Camera className="size-5 text-sky" />
                  )}
                  {reading ? "Leyendo…" : "Foto"}
                </Button>
                <Button variant="secondary" className="rounded-full" onClick={speakExpense}>
                  <Mic
                    className={cn("size-5 text-sky", listening && "animate-pulse text-accent")}
                  />
                  Dictar
                </Button>
              </div>
            ) : null}
            {form.receipt ? (
              <img
                src={form.receipt}
                alt="Recibo"
                className="h-28 w-full rounded-xl object-cover"
              />
            ) : null}
            <Field
              label="¿Cuánto gastaste?"
              inputMode="decimal"
              placeholder="$ 0.00"
              className="h-14 text-[22px] font-bold"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground">
                ¿En qué?
                {suggested ? (
                  <span className="flex items-center gap-1 text-accent">
                    <Sparkles className="size-3.5" /> Sugerido
                  </span>
                ) : null}
              </p>
              <Chips
                options={expenseCategories.map((c) => {
                  const { icon: Icon, tone } = expenseVisual[c];
                  return {
                    key: c,
                    label: c,
                    icon: (
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full",
                          form.category === c ? "bg-primary-foreground/15" : toneChip[tone],
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                    ),
                  };
                })}
                value={form.category}
                onChange={(c) => {
                  setForm({ ...form, category: c });
                  setSuggested(false);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Tienda"
                placeholder="Home Depot"
                value={form.store}
                onChange={(e) => setForm({ ...form, store: e.target.value })}
              />
              <Field
                label="Fecha"
                type="date"
                max={todayISO()}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <Field
              label="Nota (opcional)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <Button className="h-14 w-full rounded-full" disabled={!canSave} onClick={save}>
              <CheckCircle2 className="size-5" />
              {canSave
                ? `Guardar ${money(amount)}`
                : form.category
                  ? "Escribe el monto"
                  : "Elige en qué gastaste"}
            </Button>
            {editing ? (
              <Button
                variant="danger"
                className="w-full"
                onClick={() => {
                  remove(editing);
                  closeForm();
                }}
              >
                <Trash2 className="size-5" /> Borrar gasto
              </Button>
            ) : null}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

/** Quarterly estimated-payment dates that usually apply; shown neutrally, never as advice. */
const estimatedDates = (year: number) => [
  new Date(year, 3, 15),
  new Date(year, 5, 15),
  new Date(year, 8, 15),
  new Date(year + 1, 0, 15),
];

type ContadorSheet = "preview" | "categorias" | "impuestos" | "fechas" | "k1099" | null;

function Contador({ onTab }: { onTab: (t: Tab) => void }) {
  const { state } = useMarcelo();
  const year = todayISO().slice(0, 4);
  const n = yearNumbers(state, year);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<ContadorSheet>(null);
  const next = estimatedDates(Number(year)).find((d) => d >= new Date());
  const moves = n.payments.length + n.expenses.length;
  const receipts = n.expenses.filter((e) => e.receipt).length;

  const rowCls = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left";

  return (
    <>
      <section className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-brand-soft to-[oklch(0.84_0.07_245)] p-5">
        <div className="relative z-10 max-w-[56%]">
          <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-tight">
            Todo listo para tu contador
          </h2>
          <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
            {year} · {moves} {moves === 1 ? "movimiento organizado" : "movimientos organizados"}
          </p>
          <button
            onClick={() => setSheet("preview")}
            className="mt-4 flex h-11 items-center gap-1 rounded-full bg-card px-4 text-[15px] font-bold shadow-[var(--shadow-card)] transition-transform active:scale-95"
          >
            Vista previa <ChevronRight className="size-4" />
          </button>
        </div>
        <img
          src={accountant}
          alt=""
          aria-hidden
          className="absolute -bottom-1 -right-2 w-[48%] max-w-[190px] object-contain"
        />
        <div className="h-[84px]" aria-hidden />
      </section>

      <Button
        className="mt-3 h-14 w-full rounded-full text-[17px] shadow-[var(--shadow-card)]"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const shared = await sendToAccountant(state, year);
          setBusy(false);
          toast.success(
            shared
              ? "Listo para enviar por WhatsApp o email"
              : "Archivo descargado. Envíaselo a tu contador.",
          );
        }}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />} Enviar a
        mi contador
      </Button>
      <p className="mt-2 text-center text-[14px] text-muted-foreground">
        Incluye resumen, movimientos y fotos de recibos.
      </p>
      <button
        onClick={() => void downloadSummaryPdf(state, year)}
        className="mx-auto mt-1 flex h-11 items-center gap-1.5 px-4 text-[15px] font-bold text-sky"
      >
        <Download className="size-4" /> Solo el PDF de una página
      </button>

      <Eyebrow>Lo que va a recibir</Eyebrow>
      <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
        <div className="flex min-h-16 items-center gap-3 px-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </span>
          <span className="flex-1 text-[18px] font-extrabold">Cobrado</span>
          <span className="text-[19px] font-extrabold text-success">{money(n.income)}</span>
        </div>
        <div className="flex min-h-16 items-center gap-3 px-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <ArrowDown className="size-5" strokeWidth={2.4} />
          </span>
          <span className="flex-1 text-[18px] font-extrabold">Gastos</span>
          <span className="text-[19px] font-extrabold text-accent">−{money(n.spent)}</span>
        </div>
        <div className="flex min-h-16 items-center gap-3 px-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sky">
            <Equal className="size-5" strokeWidth={2.4} />
          </span>
          <span className="flex-1 text-[18px] font-extrabold">Ganancia</span>
          <span className="text-[19px] font-extrabold">{signedMoney(n.profit)}</span>
        </div>
        <button onClick={() => onTab("gastos")} className={rowCls}>
          <FileText className="size-6 text-muted-foreground" strokeWidth={1.6} />
          <span className="flex-1 text-[16px] text-muted-foreground">
            {receipts} de {n.expenses.length} gastos con foto de recibo
          </span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </button>
      </Card>

      <Eyebrow>Antes de enviar</Eyebrow>
      <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
        <button onClick={() => setSheet("categorias")} className={rowCls}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
            <Check className="size-5" strokeWidth={2.6} />
          </span>
          <span className="flex-1 text-[16px] font-semibold">Categorías revisadas</span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </button>
        <button onClick={() => setSheet("impuestos")} className={rowCls}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sky">
            <FileText className="size-5" />
          </span>
          <span className="flex-1 text-[16px] font-semibold">Impuestos de mi estado</span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </button>
        <button onClick={() => setSheet("fechas")} className={rowCls}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peach text-accent">
            <CalendarDays className="size-5" />
          </span>
          <span className="flex-1 text-[16px] font-semibold">Fechas para tener en cuenta</span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </button>
        <button onClick={() => setSheet("k1099")} className={rowCls}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-5" />
          </span>
          <span className="flex-1 text-[16px] font-semibold">Formulario 1099-K</span>
          <ChevronRight className="size-5 text-muted-foreground/60" />
        </button>
      </Card>

      <div className="mt-4 flex items-center gap-3 rounded-[1.25rem] bg-muted/70 p-3">
        <MascotBadge />
        <span className="h-10 w-px shrink-0 bg-border" aria-hidden />
        <p className="text-[14px] leading-snug">
          <b>Marcelo organiza tus datos.</b>
          <br />
          <span className="text-muted-foreground">
            Tu contador revisa los impuestos. Marcelo no da consejos fiscales.
          </span>
        </p>
      </div>

      {sheet === "preview" ? (
        <Sheet
          title={`Vista previa ${year}`}
          icon={<Calculator className="size-5 text-success" />}
          onClose={() => setSheet(null)}
        >
          <div className="space-y-2 text-[16px]">
            <Line label="Cobrado" value={money(n.income)} />
            {n.groups
              .sort((a, b) => b[1] - a[1])
              .map(([g, total]) => (
                <Line key={g} label={`Gastos · ${g}`} value={`−${money(total)}`} muted />
              ))}
            <div className="border-t pt-2">
              <Line label="Ganancia" value={signedMoney(n.profit)} strong />
            </div>
            <Line label="Millas registradas" value={`${n.miles.toFixed(1)} mi`} muted />
            <Line label="Recibos con foto" value={`${receipts} de ${n.expenses.length}`} muted />
          </div>
        </Sheet>
      ) : null}

      {sheet === "categorias" ? (
        <Sheet title="Categorías que ve tu contador" onClose={() => setSheet(null)}>
          <div className="space-y-1.5 text-[15px]">
            {Object.entries(
              expenseCategories.reduce<Record<string, string[]>>((acc, c) => {
                (acc[accountantGroup[c]] ??= []).push(c);
                return acc;
              }, {}),
            ).map(([g, cats]) => (
              <p key={g}>
                <span className="font-semibold">{g}:</span>{" "}
                <span className="text-muted-foreground">{cats.join(", ")}</span>
              </p>
            ))}
          </div>
        </Sheet>
      ) : null}

      {sheet === "impuestos" ? (
        <Sheet title="Impuestos de tu negocio" onClose={() => setSheet(null)}>
          <TaxCard profit={n.profit} />
        </Sheet>
      ) : null}

      {sheet === "fechas" ? (
        <Sheet title="Fechas para tener en cuenta" onClose={() => setSheet(null)}>
          <div className="space-y-2 text-[15px] leading-relaxed">
            <p>
              Quienes trabajan por su cuenta suelen hacer pagos estimados el 15 de abril, 15 de
              junio, 15 de septiembre y 15 de enero.
            </p>
            {next ? (
              <p className="font-semibold">
                La próxima:{" "}
                {next.toLocaleDateString("es-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            ) : null}
            <p className="text-muted-foreground">
              Consúltalo con tu contador: puede que no te aplique.
            </p>
          </div>
        </Sheet>
      ) : null}

      {sheet === "k1099" ? (
        <Sheet title="Formulario 1099-K" onClose={() => setSheet(null)}>
          <div className="space-y-2 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              Es un aviso de lo que te pagaron por apps o tarjeta. Llega a finales de enero de{" "}
              {Number(year) + 1}.
            </p>
            <p>
              <b>Ejemplos:</b> si te pagan por Cash App, PayPal, Venmo o con tarjeta, te puede
              llegar este formulario. Los pagos por Zelle normalmente no lo generan.
            </p>
            <p>
              Todo lo que cobras cuenta como ingreso, llegue o no el formulario. Por eso Marcelo
              guarda cada pago.
            </p>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function MascotBadge() {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft">
      <img src={character} alt="" aria-hidden className="size-11 object-contain" />
    </span>
  );
}

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex justify-between gap-3",
        muted && "text-muted-foreground",
        strong && "text-[18px] font-bold",
      )}
    >
      <span>{label}</span>
      <span className={strong ? "text-success" : "font-semibold"}>{value}</span>
    </p>
  );
}
