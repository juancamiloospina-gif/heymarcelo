import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { Badge, BackButton, Card, Chips, Empty, PageTitle, Screen } from "@/components/marcelo/kit";
import { ServiceIcon } from "@/components/marcelo/visual";
import { statusTone } from "@/components/marcelo/jobs";
import { useMarcelo } from "@/lib/marcelo-store";
import { isDoneJob, money, prettyDate, statusLabel, type JobStatus } from "@/lib/marcelo-data";

export const Route = createFileRoute("/realizados")({
  head: () => ({
    meta: [
      { title: "Servicios realizados — Marcelo" },
      { name: "description", content: "Todos los trabajos que ya terminaste, con su cobro." },
    ],
  }),
  component: Realizados,
});

type Filter = "todos" | Extract<JobStatus, "hecho" | "facturado" | "cobrado">;

/** Every finished job (done, invoiced or paid), newest first, with who, what, how much and status. */
function Realizados() {
  const { state, clientById } = useMarcelo();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");

  const done = useMemo(
    () =>
      state.jobs.filter(isDoneJob).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [state.jobs],
  );
  const list = done.filter((j) => {
    if (filter !== "todos" && j.status !== filter) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const name = clientById(j.clientId)?.name.toLowerCase() ?? "";
    return name.includes(needle) || j.service.toLowerCase().includes(needle);
  });
  const total = list.reduce((a, j) => a + j.price, 0);
  const paid = list.filter((j) => j.status === "cobrado").reduce((a, j) => a + j.price, 0);

  return (
    <Screen>
      <BackButton />
      <PageTitle
        title="Servicios realizados"
        subtitle={`${done.length} ${done.length === 1 ? "trabajo terminado" : "trabajos terminados"}`}
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente o servicio"
          className="h-11 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-[15px] outline-none focus:border-accent"
        />
      </div>
      <div className="mb-4">
        <Chips
          options={
            [
              { key: "todos", label: "Todos" },
              { key: "hecho", label: statusLabel.hecho },
              { key: "facturado", label: statusLabel.facturado },
              { key: "cobrado", label: statusLabel.cobrado },
            ] as const
          }
          value={filter}
          onChange={setFilter}
        />
      </div>

      {list.length > 0 ? (
        <Card className="mb-4 grid grid-cols-2 divide-x divide-border p-0 text-center">
          <div className="py-3">
            <p className="text-[13px] text-muted-foreground">Total</p>
            <p className="text-[20px] font-bold">{money(total)}</p>
          </div>
          <div className="py-3">
            <p className="text-[13px] text-muted-foreground">Cobrado</p>
            <p className="text-[20px] font-bold text-success">{money(paid)}</p>
          </div>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <Empty
          title="Todavía no hay servicios aquí."
          hint="Cuando termines un trabajo con “Terminé”, aparece en esta lista."
        />
      ) : (
        <div className="space-y-2">
          {list.map((j) => {
            const client = clientById(j.clientId);
            const kind = state.services.find(
              (s) => s.id === j.serviceId || s.name === j.service,
            )?.kind;
            return (
              <button
                key={j.id}
                onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: j.id } })}
                className="surface flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <ServiceIcon kind={kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">
                    {client?.name ?? "Cliente"}
                  </span>
                  <span className="block truncate text-[14px] text-muted-foreground">
                    {j.service} · {prettyDate(j.date)}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <Badge tone={statusTone[j.status]}>{statusLabel[j.status]}</Badge>
                    {j.rating ? (
                      <span className="flex items-center gap-0.5 text-[13px] font-semibold">
                        <Star className="size-3.5 fill-warning text-warning" /> {j.rating}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[16px] font-bold">
                  {money(j.price)}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
