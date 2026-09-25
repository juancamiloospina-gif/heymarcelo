import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Download,
  ChevronRight,
  ChevronDown,
  Calculator,
  Receipt,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, Empty, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  expenseCategories,
  money,
  paymentMethodLabel,
  prettyDate,
  todayISO,
} from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";
import { expenseVisual, toneBar } from "@/components/marcelo/visual";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos fiscales — Marcelo" },
      {
        name: "description",
        content: "Un resumen anual ordenado de tus ingresos, gastos y recibos para tu contador.",
      },
      { property: "og:title", content: "Documentos fiscales — Marcelo" },
      {
        property: "og:description",
        content: "Resumen anual de ingresos, gastos y recibos para tu contador.",
      },
    ],
  }),
  component: Documentos,
});

const tabs = ["Resumen", "Ingresos", "Gastos", "Recibos"] as const;

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function Documentos() {
  const { state, clientById } = useMarcelo();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Resumen");
  const [show1099, setShow1099] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const year = todayISO().slice(0, 4);

  const payments = state.payments
    .filter((p) => p.date.startsWith(year) && p.method !== "debe")
    .sort((a, b) => b.date.localeCompare(a.date));
  const expenses = state.expenses
    .filter((e) => e.date.startsWith(year))
    .sort((a, b) => b.date.localeCompare(a.date));
  const income = payments.reduce((a, b) => a + b.amount, 0);
  const spent = expenses.reduce((a, b) => a + b.amount, 0);
  const receipts = expenses.filter((e) => e.receipt);
  const byCategory = expenseCategories
    .map((c) => ({
      category: c,
      total: expenses.filter((e) => e.category === c).reduce((a, b) => a + b.amount, 0),
    }))
    .filter((c) => c.total > 0);
  const byMethod = (["efectivo", "zelle", "cheque"] as const)
    .map((m) => ({
      method: m,
      total: payments.filter((p) => p.method === m).reduce((a, b) => a + b.amount, 0),
    }))
    .filter((m) => m.total > 0);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Tipo", "Fecha", "Concepto", "Detalle", "Monto"],
      ...payments.map((p) => [
        "Ingreso",
        p.date,
        `Pago de ${clientById(p.clientId)?.name ?? "cliente"}`,
        paymentMethodLabel[p.method],
        p.amount,
      ]),
      ...expenses.map((e) => ["Gasto", e.date, e.category, e.note ?? "", -e.amount]),
      [],
      ["Total ingresos", "", "", "", income],
      ["Total gastos", "", "", "", -spent],
      ["Ganancia", "", "", "", income - spent],
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    // BOM so Excel opens accents correctly.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcelo-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo descargado. Envíaselo a tu contador.");
  };

  return (
    <Screen>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          aria-label="Atrás"
          className="text-muted-foreground"
        >
          <ChevronRight className="size-6 rotate-180" />
        </button>
      </div>

      <PageTitle title="Documentos fiscales" subtitle={`Año ${year}`} />

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Resumen" && (
        <>
          <Card className="relative mb-6 overflow-hidden border-success/15 bg-success/10 p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-success/20 text-success">
                <Calculator className="size-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-foreground">Resumen anual {year}</h3>
                <p className="text-[13px] text-muted-foreground">
                  Tus números listos para tu contador.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-muted-foreground">Ingresos totales</span>
                <span className="text-[17px] font-bold">{money(income)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-muted-foreground">Gastos totales</span>
                <span className="text-[17px] font-bold">{money(spent)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-success/20 pt-3">
                <span className="text-[15px] font-bold">Ingresos netos</span>
                <span
                  className={cn(
                    "text-[20px] font-bold",
                    income - spent >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {income - spent < 0 ? "−" : ""}
                  {money(income - spent)}
                </span>
              </div>
            </div>
          </Card>

          <SectionTitle>Otros documentos</SectionTitle>
          <Card className="mb-6 p-0">
            <button
              onClick={() => setShow1099((v) => !v)}
              aria-expanded={show1099}
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-accent">
                <FileText className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">Formulario 1099-K</span>
                <span className="block text-[13px] text-muted-foreground">
                  ¿Qué es y cuándo llega?
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-5 text-muted-foreground/50 transition-transform",
                  show1099 && "rotate-180",
                )}
              />
            </button>
            {show1099 ? (
              <div className="space-y-2 px-4 pb-4 text-[14px] leading-relaxed text-muted-foreground">
                <p>
                  Es el formulario que te mandan las apps de pago (como PayPal o Venmo) cuando
                  recibes pagos por trabajo a través de ellas. Llega a finales de enero de{" "}
                  {Number(year) + 1}.
                </p>
                <p>
                  Los pagos por Zelle normalmente no generan 1099-K. Aun así, todo lo que cobras
                  cuenta como ingreso, por eso Marcelo lo guarda aquí.
                </p>
              </div>
            ) : null}
          </Card>

          <Button className="h-14 w-full rounded-2xl" onClick={exportCsv}>
            <Download className="size-5" /> Descargar para mi contador
          </Button>
          <p className="mt-2 text-center text-[12px] text-muted-foreground">
            Archivo de Excel (CSV) con todos tus ingresos y gastos del año.
          </p>
        </>
      )}

      {activeTab === "Ingresos" && (
        <>
          {byMethod.length > 0 ? (
            <div className="mb-5 grid grid-cols-3 gap-2">
              {byMethod.map((m) => (
                <Card key={m.method} className="p-3 text-center">
                  <p className="text-[12px] text-muted-foreground">
                    {paymentMethodLabel[m.method]}
                  </p>
                  <p className="mt-0.5 text-[16px] font-bold">{money(m.total)}</p>
                </Card>
              ))}
            </div>
          ) : null}
          {payments.length === 0 ? (
            <Empty title="Sin ingresos este año." hint="Cuando registres un cobro, aparece aquí." />
          ) : (
            <Card className="divide-y divide-border p-0">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">
                      {clientById(p.clientId)?.name ?? "Cliente"}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {prettyDate(p.date)} · {paymentMethodLabel[p.method]}
                    </p>
                  </div>
                  <p className="text-[15px] font-semibold text-success">+{money(p.amount)}</p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {activeTab === "Gastos" && (
        <>
          {byCategory.length > 0 ? (
            <Card className="mb-5 space-y-3">
              {byCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex justify-between text-[14px]">
                    <span className="font-medium">{c.category}</span>
                    <span className="font-semibold">{money(c.total)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", toneBar[expenseVisual[c.category].tone])}
                      style={{ width: `${(c.total / spent) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </Card>
          ) : null}
          {expenses.length === 0 ? (
            <Empty
              title="Sin gastos este año."
              hint="Anota tus gastos para pagar menos impuestos."
            />
          ) : (
            <Card className="divide-y divide-border p-0">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
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
          )}
        </>
      )}

      {activeTab === "Recibos" && (
        <div className="space-y-3">
          {receipts.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="mx-auto mb-3 size-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">No tienes recibos guardados aún.</p>
              <p className="mt-1 text-[13px] text-muted-foreground/80">
                Toma una foto al anotar un gasto.
              </p>
            </div>
          ) : (
            receipts.map((e) => (
              <Card key={e.id} className="p-0" onClick={() => setViewing(e.receipt ?? null)}>
                <div className="flex items-center gap-4 p-4">
                  <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    <img src={e.receipt} alt="" className="size-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="truncate text-[15px] font-semibold">{e.note || e.category}</h4>
                      <ChevronRight className="size-4 text-muted-foreground/50" />
                    </div>
                    <p className="text-[13px] text-muted-foreground">{e.category}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground/70">
                      {prettyDate(e.date)} · {money(e.amount)}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {viewing ? (
        <div
          role="dialog"
          aria-label="Recibo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setViewing(null)}
        >
          <button
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="size-5" />
          </button>
          <img
            src={viewing}
            alt="Recibo"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      ) : null}

      <p className="mx-auto mt-8 max-w-[280px] text-center text-[12px] leading-relaxed text-muted-foreground">
        Marcelo organiza tu información. No reemplaza a un contador ni da consejos de impuestos.
      </p>
    </Screen>
  );
}
