import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowDownLeft,
  Banknote,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
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
  Tabs,
} from "@/components/marcelo/kit";
import { PaymentSheet } from "@/components/marcelo/jobs";
import { Swipeable } from "@/components/marcelo/reminders";
import { IconChip, expenseVisual, toneChip } from "@/components/marcelo/visual";
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
      <PageTitle title="Dinero" />
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
      {tab === "contador" ? <Contador /> : null}
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
      <Card className="bg-primary text-primary-foreground">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/60">
          Este mes
        </p>
        <p className="mt-2 text-[36px] font-bold leading-none">{signedMoney(profit)}</p>
        <p className="mt-1 text-[15px] text-primary-foreground/70">Ganancia</p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-primary-foreground/15 pt-4">
          <div>
            <p className="text-[14px] text-primary-foreground/60">Cobrado</p>
            <p className="text-[18px] font-semibold">{money(income)}</p>
          </div>
          <div>
            <p className="text-[14px] text-primary-foreground/60">Gastos</p>
            <p className="text-[18px] font-semibold">{money(spent)}</p>
          </div>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          className="bg-success text-white hover:bg-success/90"
          onClick={() => setPaying(true)}
        >
          <Banknote className="size-5" /> Cobré
        </Button>
        <Button variant="secondary" onClick={() => onTab("gastos")}>
          <Plus className="size-5" /> Anotar gasto
        </Button>
      </div>

      {owed > 0 ? (
        <Card className="mt-3 flex items-center gap-3" onClick={() => onTab("cobrar")}>
          <IconChip icon={HandCoins} tone="warning" />
          <p className="flex-1 text-[16px] font-semibold">Por cobrar: {money(owed)}</p>
          <span className="text-[15px] font-semibold text-accent">Ver</span>
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
        <Card className="divide-y divide-border p-0">
          {movements.map((m) => (
            <div key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
              {m.category ? (
                <IconChip
                  icon={expenseVisual[m.category].icon}
                  tone={expenseVisual[m.category].tone}
                  size="sm"
                />
              ) : (
                <IconChip icon={ArrowDownLeft} tone="success" size="sm" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{m.label}</span>
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

function PorCobrar() {
  const { state, clientById, addReceivable, queueJobMessage } = useMarcelo();
  const [paying, setPaying] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ clientId: "", amount: "", note: "" });
  const open = state.receivables
    .filter((r) => !r.paidAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const paid = state.receivables.filter((r) => r.paidAt).slice(0, 8);
  const total = open.reduce((a, b) => a + b.amount, 0);

  return (
    <>
      <Card className="mb-4 flex items-center gap-3">
        <IconChip icon={HandCoins} tone="warning" />
        <div className="flex-1">
          <p className="text-[14px] text-muted-foreground">Te deben</p>
          <p className="text-[24px] font-bold">{money(total)}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-5" /> Agregar
        </Button>
      </Card>

      {adding ? (
        <Card className="mb-4 space-y-3">
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

      {open.length === 0 ? (
        <Empty
          title="Nadie te debe."
          hint="Cuando un cliente no pague al terminar, aparece aquí."
        />
      ) : (
        <div className="space-y-2">
          {open.map((r) => {
            const days = daysBetween(r.createdAt, todayISO());
            const job = state.jobs.find((j) => j.id === r.jobId);
            return (
              <Card key={r.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">
                    {clientById(r.clientId)?.name ?? "Cliente"}
                  </p>
                  <p className="truncate text-[14px] text-muted-foreground">
                    {r.note ?? "Sin detalle"} ·{" "}
                    <span className={days >= 7 ? "font-semibold text-destructive" : ""}>
                      {days === 0 ? "hoy" : `hace ${days} ${days === 1 ? "día" : "días"}`}
                    </span>
                  </p>
                </div>
                <p className="text-[18px] font-bold">{money(r.amount)}</p>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    className="bg-success text-white"
                    onClick={() => setPaying(r.id)}
                  >
                    Cobré
                  </Button>
                  {job ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        queueJobMessage("invoice", job.id, "ask");
                      }}
                    >
                      <Send className="size-4" /> Recordar
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {paid.length ? (
        <>
          <SectionTitle>Ya cobrado</SectionTitle>
          <Card className="divide-y divide-border p-0 opacity-70">
            {paid.map((r) => (
              <div
                key={r.id}
                className="flex min-h-12 items-center justify-between px-4 py-2 text-[15px]"
              >
                <span>{clientById(r.clientId)?.name}</span>
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-4" /> {money(r.amount)}
                </span>
              </div>
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

function Gastos() {
  const { state, addExpense, updateExpense, removeExpense, restoreExpense } = useMarcelo();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [listening, setListening] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const month = monthISO();
  const total = state.expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((a, b) => a + b.amount, 0);
  const amount = Number(form.amount.replace(/[$,\s]/g, ""));
  const canSave = amount > 0 && form.category !== null;

  const onPhoto = (file: File) => {
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
    setForm({ ...emptyForm, date: todayISO() });
    setEditing(null);
    setSuggested(false);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (id: string) => {
    const removed = removeExpense(id);
    if (removed)
      toast("Gasto borrado", {
        action: { label: "Deshacer", onClick: () => restoreExpense(removed) },
      });
  };

  return (
    <>
      <p className="mb-3 text-[16px] text-muted-foreground">Llevas {money(total)} este mes.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPhoto(f);
          e.target.value = "";
        }}
      />
      {!editing ? (
        <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
          <Button
            className="h-16 text-[17px]"
            onClick={() => fileRef.current?.click()}
            disabled={reading}
          >
            {reading ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
            {reading ? "Leyendo el recibo…" : "Foto del recibo"}
          </Button>
          <Button
            variant="secondary"
            className="h-16 w-16 px-0"
            aria-label="Dictar gasto"
            onClick={speakExpense}
          >
            <Mic className={cn("size-6", listening && "animate-pulse text-accent")} />
          </Button>
        </div>
      ) : null}

      <Card className="space-y-4">
        {editing ? <p className="text-[16px] font-bold">Editar gasto</p> : null}
        {form.receipt ? (
          <img src={form.receipt} alt="Recibo" className="h-28 w-full rounded-xl object-cover" />
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
        {editing ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm, date: todayISO() });
            }}
          >
            Cancelar edición
          </Button>
        ) : null}
      </Card>

      {/* Save stays reachable above the floating bar while the form scrolls. */}
      <div className="sticky bottom-24 z-20 mt-3">
        <Button
          className="h-14 w-full shadow-[var(--shadow-lift)]"
          disabled={!canSave}
          onClick={save}
        >
          <CheckCircle2 className="size-5" />
          {canSave
            ? `Guardar ${money(amount)}`
            : form.category
              ? "Escribe el monto"
              : "Elige en qué gastaste"}
        </Button>
      </div>

      <SectionTitle>Últimos gastos</SectionTitle>
      {state.expenses.length === 0 ? (
        <Empty title="Sin gastos todavía." hint="Toma una foto del recibo y Marcelo lo anota." />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {state.expenses.slice(0, 30).map((e) => (
            <Swipeable key={e.id} onLeft={() => remove(e.id)}>
              <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                <button
                  onClick={() => edit(e)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <IconChip
                    icon={expenseVisual[e.category].icon}
                    tone={expenseVisual[e.category].tone}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">
                      {e.store ?? e.category}
                    </span>
                    <span className="block truncate text-[14px] text-muted-foreground">
                      {prettyDate(e.date)} · {e.category}
                      {e.receipt ? " · con recibo" : ""}
                    </span>
                  </span>
                </button>
                <span className="whitespace-nowrap text-[16px] font-bold text-destructive">
                  −{money(e.amount)}
                </span>
                <button
                  aria-label={`Borrar gasto de ${e.category}`}
                  className="flex size-12 items-center justify-center rounded-full text-muted-foreground/60 hover:text-destructive"
                  onClick={() => remove(e.id)}
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            </Swipeable>
          ))}
        </Card>
      )}
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

function Contador() {
  const { state } = useMarcelo();
  const year = todayISO().slice(0, 4);
  const n = yearNumbers(state, year);
  const [busy, setBusy] = useState(false);
  const [show1099, setShow1099] = useState(false);
  const next = estimatedDates(Number(year)).find((d) => d >= new Date());

  return (
    <>
      <Card className="border-success/15 bg-success/10 p-5">
        <div className="mb-4 flex items-start gap-3">
          <IconChip icon={Calculator} tone="success" />
          <div>
            <p className="text-[18px] font-bold">Resumen {year}</p>
            <p className="text-[14px] text-muted-foreground">Listo para tu contador.</p>
          </div>
        </div>
        <div className="space-y-2 text-[16px]">
          <Line label="Cobrado" value={money(n.income)} />
          {n.groups
            .sort((a, b) => b[1] - a[1])
            .map(([g, total]) => (
              <Line key={g} label={`Gastos · ${g}`} value={`−${money(total)}`} muted />
            ))}
          <div className="border-t border-success/20 pt-2">
            <Line label="Ganancia" value={signedMoney(n.profit)} strong />
          </div>
          <Line label="Millas registradas" value={`${n.miles.toFixed(1)} mi`} muted />
          <Line
            label="Recibos con foto"
            value={`${n.expenses.filter((e) => e.receipt).length} de ${n.expenses.length}`}
            muted
          />
        </div>
      </Card>

      <div className="mt-3 grid gap-2">
        <Button
          className="h-14"
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
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />} Enviar
          a mi contador
        </Button>
        <Button variant="secondary" onClick={() => void downloadSummaryPdf(state, year)}>
          <Download className="size-5" /> Solo el PDF de una página
        </Button>
        <p className="text-center text-[14px] text-muted-foreground">
          Incluye PDF, hoja de Excel (CSV) y las fotos de tus recibos.
        </p>
      </div>

      <SectionTitle>Categorías que ve tu contador</SectionTitle>
      <Card className="space-y-1.5 text-[15px]">
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
      </Card>

      <SectionTitle>Fechas para tener en cuenta</SectionTitle>
      <Card className="space-y-2 text-[15px] leading-relaxed">
        <p>
          Quienes trabajan por su cuenta suelen hacer pagos estimados el 15 de abril, 15 de junio,
          15 de septiembre y 15 de enero.
        </p>
        {next ? (
          <p className="font-semibold">
            La próxima:{" "}
            {next.toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        ) : null}
        <p className="text-muted-foreground">
          Consúltalo con tu contador: puede que no te aplique.
        </p>
      </Card>

      <SectionTitle>Formulario 1099-K</SectionTitle>
      <Card className="p-0">
        <button
          onClick={() => setShow1099((v) => !v)}
          aria-expanded={show1099}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
        >
          <FileText className="size-5 text-accent" />
          <span className="flex-1 text-[16px] font-semibold">¿Qué es y cuándo llega?</span>
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform",
              show1099 && "rotate-180",
            )}
          />
        </button>
        {show1099 ? (
          <div className="space-y-2 px-4 pb-4 text-[15px] leading-relaxed text-muted-foreground">
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
        ) : null}
      </Card>

      <p className="mx-auto mt-6 max-w-[300px] text-center text-[14px] leading-relaxed text-muted-foreground">
        Marcelo organiza tu información. No reemplaza a un contador ni da consejos de impuestos.
      </p>
    </>
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
