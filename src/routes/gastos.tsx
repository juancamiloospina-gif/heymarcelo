import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyDate, todayISO, type Expense } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gastos")({
  head: () => ({
    meta: [
      { title: "Gastos — Marcelo" },
      { name: "description", content: "Anota gasolina, herramientas y materiales en segundos, o con una foto." },
      { property: "og:title", content: "Gastos — Marcelo" },
      { property: "og:description", content: "Anota gasolina, herramientas y materiales en segundos." },
    ],
  }),
  component: Gastos,
});

const categories: Expense["category"][] = [
  "Gasolina",
  "Herramientas",
  "Materiales",
  "Vehículo",
  "Publicidad",
  "Otros",
];

function Gastos() {
  const { state, addExpense } = useMarcelo();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Expense["category"]>("Gasolina");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const month = new Date().toISOString().slice(0, 7);
  const total = state.expenses.filter((e) => e.date.startsWith(month)).reduce((a, b) => a + b.amount, 0);

  return (
    <Screen>
      <PageTitle title="Gastos" subtitle={`Llevas ${money(total)} este mes.`} />

      <div className="mb-4 grid grid-cols-3 rounded-xl bg-muted p-1 text-center text-[11px] font-semibold text-muted-foreground"><span className="px-2 py-2">Resumen</span><span className="px-2 py-2">Ingresos</span><span className="rounded-lg bg-primary px-2 py-2 text-primary-foreground">Gastos</span></div>

      <Card className="space-y-4">
        <Field
          label="¿Cuánto gastaste?"
          inputMode="decimal"
          placeholder="45"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">¿En qué?</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
                   category === c ? "bg-accent text-accent-foreground" : "border border-border bg-card text-muted-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />

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
        <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
          <Camera className="size-4" /> {receipt ? "Recibo adjuntado" : "Tomar foto del recibo"}
        </Button>

        <Button
          className="w-full"
          disabled={!Number(amount)}
          onClick={() => {
            addExpense({ amount: Number(amount), category, note: note || undefined, date: todayISO(), receipt });
            setAmount("");
            setNote("");
            setReceipt(undefined);
            toast.success("Gasto registrado");
          }}
        >
          <Plus className="size-4" /> Guardar gasto
        </Button>
      </Card>

      <SectionTitle>Últimos gastos</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {state.expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{e.category}</p>
              <p className="truncate text-[12px] text-muted-foreground">
                {prettyDate(e.date)}
                {e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <p className="text-[15px] font-semibold">−{money(e.amount)}</p>
          </div>
        ))}
      </Card>
    </Screen>
  );
}
