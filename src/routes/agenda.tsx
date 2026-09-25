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
      {
        name: "description",
        content: "Tus citas de hoy, mañana y esta semana en una lista clara y sencilla.",
      },
      { property: "og:title", content: "Agenda — Marcelo" },
      {
        property: "og:description",
        content: "Tus citas de hoy, mañana y esta semana en una lista clara.",
      },
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
      filter === "hoy"
        ? j.date === todayISO()
        : filter === "manana"
          ? j.date === todayISO(1)
          : j.date >= todayISO() && j.date <= weekEnd,
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const grouped = jobs.reduce<Record<string, typeof jobs>>((acc, j) => {
    (acc[j.date] ??= []).push(j);
    return acc;
  }, {});
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${todayISO(index)}T12:00:00`);
    return {
      day: date.toLocaleDateString("es-US", { weekday: "narrow" }),
      number: date.getDate(),
      active: index === 0,
    };
  });

  return (
    <Screen>
      <PageTitle title="Agenda" subtitle={prettyDate(todayISO())} />

      <div className="mb-4 grid grid-cols-7 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-card)]">
        {weekdays.map((day, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-1 text-[10px] font-semibold text-muted-foreground"
          >
            <span className="uppercase">{day.day}</span>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-[12px]",
                day.active && "bg-primary text-primary-foreground",
              )}
            >
              {day.number}
            </span>
          </div>
        ))}
      </div>

      <div className="mb-5 flex rounded-2xl bg-muted p-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex-1 rounded-xl px-2 py-2 text-[12px] font-semibold transition-colors",
              filter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <Empty
          title="No hay trabajos en estos días."
          hint="Dime a quién tienes que visitar y yo lo agendo por ti."
        />
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
                  <Card
                    key={job.id}
                    className="relative overflow-hidden pl-5"
                    onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } })}
                  >
                    <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-accent">
                          {prettyTime(job.time)}
                        </p>
                        <p className="mt-0.5 truncate text-[16px] font-semibold">
                          {client?.name ?? "Cliente"}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                          {job.service}
                        </p>
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
