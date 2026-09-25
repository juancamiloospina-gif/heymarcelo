import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Card, Empty, PageTitle, Screen } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyDate, prettyTime, todayISO } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Marcelo" },
      { name: "description", content: "Tus citas de hoy, mañana y esta semana en una lista clara y sencilla." },
      { property: "og:title", content: "Agenda — Marcelo" },
      { property: "og:description", content: "Tus citas de hoy, mañana y esta semana en una lista clara." },
    ],
  }),
  component: Agenda,
});

const filters = [
  { key: "hoy", label: "Hoy" },
  { key: "manana", label: "Mañana" },
  { key: "semana", label: "Esta semana" },
] as const;

function Agenda() {
  const { state, clientById } = useMarcelo();
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("hoy");
  const navigate = useNavigate();

  const weekEnd = todayISO(7);
  const jobs = state.jobs
    .filter((j) =>
      filter === "hoy" ? j.date === todayISO() : filter === "manana" ? j.date === todayISO(1) : j.date >= todayISO() && j.date <= weekEnd,
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const grouped = jobs.reduce<Record<string, typeof jobs>>((acc, j) => {
    (acc[j.date] ??= []).push(j);
    return acc;
  }, {});

  return (
    <Screen>
      <PageTitle title="Agenda" subtitle="Lo que tienes por delante." />

      <div className="mb-5 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              filter === f.key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <Empty title="No hay trabajos en estos días." hint="Dime a quién tienes que visitar y yo lo agendo por ti." />
      ) : (
        Object.entries(grouped).map(([date, list]) => (
          <div key={date} className="mb-6">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {prettyDate(date)}
            </p>
            <div className="space-y-3">
              {list.map((job) => {
                const client = clientById(job.clientId);
                return (
                  <Card key={job.id} onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } })}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-accent">{prettyTime(job.time)}</p>
                        <p className="mt-0.5 truncate text-[16px] font-semibold">{client?.name ?? "Cliente"}</p>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{job.service}</p>
                        {client ? (
                          <p className="mt-1 truncate text-[12px] text-muted-foreground">
                            {client.address}, {client.city}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-semibold">{money(job.price)}</p>
                        <div className="mt-2">
                          {job.status === "completado" ? (
                            <Badge tone="success">Completado</Badge>
                          ) : job.status === "confirmado" ? (
                            <Badge tone="neutral">Confirmado</Badge>
                          ) : (
                            <Badge tone="warning">Por confirmar</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </Screen>
  );
}
