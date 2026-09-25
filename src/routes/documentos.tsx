import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money } from "@/lib/marcelo-data";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — Marcelo" },
      { name: "description", content: "Un resumen anual ordenado de tus ingresos, gastos y recibos para tu contador." },
      { property: "og:title", content: "Documentos — Marcelo" },
      { property: "og:description", content: "Resumen anual de ingresos, gastos y recibos para tu contador." },
    ],
  }),
  component: Documentos,
});

function Documentos() {
  const { state } = useMarcelo();
  const year = String(new Date().getFullYear());
  const income = state.payments
    .filter((p) => p.date.startsWith(year) && p.method !== "debe")
    .reduce((a, b) => a + b.amount, 0);
  const spent = state.expenses.filter((e) => e.date.startsWith(year)).reduce((a, b) => a + b.amount, 0);
  const receipts = state.expenses.filter((e) => e.receipt).length;

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

  return (
    <Screen>
      <PageTitle title="Documentos" subtitle="Todo ordenado para cuando lo necesites." />

      <Card>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Resumen {year}</p>
        <div className="mt-3 space-y-2 text-[15px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ingresos</span>
            <span className="font-semibold">{money(income)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gastos</span>
            <span className="font-semibold">{money(spent)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Ganancia</span>
            <span className="font-semibold">{money(income - spent)}</span>
          </div>
        </div>
      </Card>

      <SectionTitle>Documentos disponibles</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {[
          { label: "Resumen anual", hint: `${year}` },
          { label: "Gastos", hint: `${state.expenses.length} registrados` },
          { label: "Recibos", hint: receipts ? `${receipts} con foto` : "Sin fotos todavía" },
        ].map((d) => (
          <div key={d.label} className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-accent">
              <FileText className="size-4" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{d.label}</span>
              <span className="block text-[13px] text-muted-foreground">{d.hint}</span>
            </span>
          </div>
        ))}
      </Card>

      <Button className="mt-5 w-full" onClick={exportSummary}>
        <Download className="size-4" /> Para mi contador
      </Button>
      <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
        Marcelo organiza tu información. No reemplaza a un contador ni da consejos de impuestos.
      </p>
    </Screen>
  );
}
