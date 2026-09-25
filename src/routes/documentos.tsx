import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download, ChevronRight, Calculator, PieChart, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, PageTitle, Screen, SectionTitle, Badge } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos fiscales — Marcelo" },
      { name: "description", content: "Un resumen anual ordenado de tus ingresos, gastos y recibos para tu contador." },
      { property: "og:title", content: "Documentos fiscales — Marcelo" },
      { property: "og:description", content: "Resumen anual de ingresos, gastos y recibos para tu contador." },
    ],
  }),
  component: Documentos,
});

function Documentos() {
  const { state } = useMarcelo();
  const [activeTab, setActiveTab] = useState("Resumen");
  const year = String(new Date().getFullYear());
  
  const income = state.payments
    .filter((p) => p.date.startsWith(year) && p.method !== "debe")
    .reduce((a, b) => a + b.amount, 0);
  const spent = state.expenses.filter((e) => e.date.startsWith(year)).reduce((a, b) => a + b.amount, 0);
  const receipts = state.expenses.filter((e) => e.receipt);

  const exportSummary = () => {
    const lines = [
      `Resumen ${year} — ${state.profile.name || "Carlos"}`,
      `Ingresos: ${money(income)}`,
      `Gastos: ${money(spent)}`,
      `Ganancia: ${money(income - spent)}`,
      "",
      "Gastos detallados:",
      ...state.expenses.map((e) => `${e.date} · ${e.category} · ${money(e.amount)}${e.note ? ` · ${e.note}` : ""}`),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcelo-resumen-${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Resumen descargado");
  };

  const tabs = ["Resumen", "Ingresos", "Gastos", "Recibos"];

  return (
    <Screen>
      <div className="flex items-center justify-between mb-2">
         <button onClick={() => window.history.back()} className="text-muted-foreground">
           <ChevronRight className="size-6 rotate-180" />
         </button>
      </div>
      
      <PageTitle title="Documentos fiscales" />

      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors",
              activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Resumen" && (
        <>
          <Card className="relative mb-6 overflow-hidden border-success/15 bg-success/10 p-5">
            <div className="relative z-10">
              <div className="flex items-start gap-3 mb-4">
                <div className="size-10 rounded-xl bg-success/20 flex items-center justify-center text-success">
                  <Calculator className="size-5" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-foreground">Resumen anual {year}</h3>
                  <p className="text-[13px] text-muted-foreground">Tus documentos están listos para tu contador.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[15px] text-muted-foreground">Ingresos totales</span>
                  <span className="text-[17px] font-bold">{money(income)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[15px] text-muted-foreground">Gastos totales</span>
                  <span className="text-[17px] font-bold">{money(spent)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-success/20 pt-3">
                  <span className="text-[15px] font-bold">Ingresos netos</span>
                  <span className="text-[20px] font-bold text-success">{money(income - spent)}</span>
                </div>
              </div>
            </div>
          </Card>

          <SectionTitle>Otros documentos</SectionTitle>
          <Card className="divide-y divide-border p-0 mb-6">
            <button className="flex items-center gap-3 px-4 py-4 w-full text-left">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-accent">
                <FileText className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">Formulario 1099-K</span>
                <span className="block text-[13px] text-muted-foreground">(Disponible en enero {Number(year) + 1})</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground/50" />
            </button>
          </Card>

          <Button className="h-14 w-full rounded-2xl" onClick={exportSummary}>
            Ver todos los documentos
          </Button>
        </>
      )}

      {activeTab === "Recibos" && (
        <div className="space-y-3">
          {receipts.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="size-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No tienes recibos guardados aún.</p>
            </div>
          ) : (
            receipts.map((e, i) => (
              <Card key={e.id} className="p-0 overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="size-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {e.receipt ? (
                      <img src={e.receipt} alt="Recibo" className="size-full object-cover" />
                    ) : (
                      <Receipt className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-[15px] truncate">Recibo #{1043 - i}</h4>
                      <ChevronRight className="size-4 text-muted-foreground/50" />
                    </div>
                    <p className="text-[13px] text-muted-foreground">{e.category} — {e.note || "Sin descripción"}</p>
                    <p className="text-[12px] text-muted-foreground/70 mt-0.5">{e.date} · {money(e.amount)}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <p className="mt-8 text-center text-[12px] leading-relaxed text-muted-foreground max-w-[280px] mx-auto">
        Marcelo organiza tu información. No reemplaza a un contador ni da consejos de impuestos.
      </p>
    </Screen>
  );
}
