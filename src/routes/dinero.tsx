import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { Button, Card, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo, useMoney } from "@/lib/marcelo-store";
import { money, prettyDate } from "@/lib/marcelo-data";

export const Route = createFileRoute("/dinero")({
  head: () => ({
    meta: [
      { title: "Tu dinero — Marcelo" },
      { name: "description", content: "Cuánto hiciste, cuánto gastaste y quién te debe, sin complicaciones." },
      { property: "og:title", content: "Tu dinero — Marcelo" },
      { property: "og:description", content: "Cuánto hiciste, cuánto gastaste y quién te debe." },
    ],
  }),
  component: Dinero,
});

function Dinero() {
  const { state, clientById } = useMarcelo();
  const { income, spent, profit, owed } = useMoney();
  const navigate = useNavigate();

  const movements = [
    ...state.payments.map((p) => ({
      id: p.id,
      date: p.date,
      label: `Pago de ${clientById(p.clientId)?.name ?? "cliente"}`,
      amount: p.amount,
    })),
    ...state.expenses.map((e) => ({ id: e.id, date: e.date, label: e.category, amount: -e.amount })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <Screen>
      <PageTitle title="Tu dinero" subtitle="Lo que entra y lo que sale este mes." />

      <Card className="bg-primary text-primary-foreground">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/60">Este mes</p>
        <p className="mt-2 text-[34px] font-semibold leading-none">{money(profit)}</p>
        <p className="mt-1 text-[13px] text-primary-foreground/70">Ganancia</p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-primary-foreground/15 pt-4">
          <div>
            <p className="text-[12px] text-primary-foreground/60">Ingresos</p>
            <p className="mt-0.5 text-[17px] font-semibold">{money(income)}</p>
          </div>
          <div>
            <p className="text-[12px] text-primary-foreground/60">Gastos</p>
            <p className="mt-0.5 text-[17px] font-semibold">{money(spent)}</p>
          </div>
        </div>
      </Card>

      {owed > 0 ? (
        <Card className="mt-3" onClick={() => navigate({ to: "/pendientes" })}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold">Te deben {money(owed)}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Ver a quién cobrarle</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Card>
      ) : null}

      <SectionTitle>Últimos movimientos</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {movements.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
            <span
              className={
                m.amount > 0
                  ? "flex size-9 items-center justify-center rounded-full bg-success/12 text-success"
                  : "flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
              }
            >
              {m.amount > 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{m.label}</span>
              <span className="block text-[12px] text-muted-foreground">{prettyDate(m.date)}</span>
            </span>
            <span className={m.amount > 0 ? "text-[15px] font-semibold text-success" : "text-[15px] font-semibold"}>
              {m.amount > 0 ? "+" : "−"}
              {money(m.amount)}
            </span>
          </div>
        ))}
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => navigate({ to: "/gastos" })}>
          Gastos
        </Button>
        <Button variant="secondary" onClick={() => navigate({ to: "/documentos" })}>
          Documentos
        </Button>
      </div>
    </Screen>
  );
}
