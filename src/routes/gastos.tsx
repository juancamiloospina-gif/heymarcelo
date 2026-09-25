import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Plus, Receipt, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Empty,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
} from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  expenseCategories,
  money,
  monthISO,
  prettyDate,
  todayISO,
  type Expense,
} from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gastos")({
  head: () => ({
    meta: [
      { title: "Gastos — Marcelo" },
      {
        name: "description",
        content: "Anota gasolina, herramientas y materiales en segundos, o con una foto.",
      },
      { property: "og:title", content: "Gastos — Marcelo" },
      {
        property: "og:description",
        content: "Anota gasolina, herramientas y materiales en segundos.",
      },
    ],
  }),
  component: Gastos,
});

function Gastos() {
  const { state, addExpense, removeExpense } = useMarcelo();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Expense["category"]>("Gasolina");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedAmount = Number(amount.replace(/[$,\s]/g, ""));
  const month = monthISO();
  const total = state.expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((a, b) => a + b.amount, 0);

  return (
    <Screen>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => window.history.back()} className="text-muted-foreground">
          <ArrowLeft className="size-6" />
        </button>
      </div>

      <PageTitle title="Gastos" subtitle={`Llevas ${money(total)} este mes.`} />

      <Card className="space-y-6 p-6 border-none shadow-sm mb-8">
        <Field
          label="¿Cuánto gastaste?"
          inputMode="decimal"
          placeholder="$ 0.00"
          className="text-[20px] font-bold h-14"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
            ¿En qué?
          </p>
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-4 py-2 text-[14px] font-medium transition-all",
                  category === c
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Nota (opcional)"
          placeholder="Ej. Home Depot, Chevron..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              setReceipt(String(reader.result));
              toast.success("Recibo adjuntado");
            };
            reader.readAsDataURL(file);
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="h-14 min-w-0 rounded-2xl border-dashed px-3 text-[12px]"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-5" />
            <span className="truncate">{receipt ? "Cambiar foto" : "Foto del recibo"}</span>
          </Button>

          <Button
            className="h-14 min-w-0 rounded-2xl bg-primary px-3 text-[12px] text-primary-foreground shadow-lg"
            disabled={!(parsedAmount > 0)}
            onClick={() => {
              addExpense({
                amount: parsedAmount,
                category,
                note: note || undefined,
                date: todayISO(),
                receipt,
              });
              setAmount("");
              setNote("");
              setReceipt(undefined);
              toast.success("Gasto registrado");
            }}
          >
            <Plus className="size-5" /> Guardar gasto
          </Button>
        </div>
      </Card>

      <SectionTitle>Últimos gastos</SectionTitle>
      {state.expenses.length === 0 ? (
        <Empty
          title="Sin gastos todavía."
          hint="Cuando anotes gasolina, herramientas o materiales, aparecen aquí."
        />
      ) : null}
      <div className="space-y-3">
        {state.expenses.map((e) => (
          <div
            key={e.id}
            className="surface flex items-center justify-between px-4 py-4 border-none shadow-sm rounded-2xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Receipt className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-foreground">{e.category}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {prettyDate(e.date)}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <p className="whitespace-nowrap text-[16px] font-bold text-destructive">
                −{money(e.amount)}
              </p>
              <button
                aria-label={`Borrar gasto de ${e.category}`}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground/60 hover:bg-muted hover:text-destructive"
                onClick={() => {
                  if (confirm(`¿Borrar este gasto de ${money(e.amount)}?`)) {
                    removeExpense(e.id);
                    toast.success("Gasto borrado");
                  }
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
