import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus, Users } from "lucide-react";
import { Button, PageTitle, Screen } from "@/components/marcelo/kit";
import { JobCard, NewJobSheet } from "@/components/marcelo/jobs";
import { useMarcelo } from "@/lib/marcelo-store";
import { dayShort, isActiveJob, prettyDate, todayISO } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Marcelo" },
      { name: "description", content: "Tus trabajos día por día." },
    ],
  }),
  component: Agenda,
});

const DAYS = 21;

function Agenda() {
  const { state } = useMarcelo();
  const navigate = useNavigate();
  const [day, setDay] = useState(todayISO());
  const [adding, setAdding] = useState(false);

  const visible = (d: string) =>
    state.jobs.filter(
      (j) => j.date === d && (isActiveJob(j) || j.status === "hecho" || j.status === "cobrado"),
    );
  const jobs = visible(day).sort((a, b) => a.time.localeCompare(b.time));
  const days = Array.from({ length: DAYS }, (_, i) => {
    const iso = todayISO(i);
    const d = new Date(`${iso}T12:00:00`);
    return {
      iso,
      label: dayShort[d.getDay()],
      n: d.getDate(),
      count: visible(iso).length,
      off: !state.settings.hours[d.getDay()]?.on || state.settings.blocked.includes(iso),
    };
  });

  return (
    <Screen>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="Agenda" subtitle={prettyDate(day)} />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Clientes"
            onClick={() => navigate({ to: "/clientes" })}
          >
            <Users className="size-5" />
          </Button>
          <Button size="sm" aria-label="Nuevo trabajo" onClick={() => setAdding(true)}>
            <CalendarPlus className="size-5" />
          </Button>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mb-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => setDay(d.iso)}
            aria-pressed={day === d.iso}
            aria-label={`${prettyDate(d.iso)}, ${d.count} trabajos`}
            className={cn(
              "flex w-14 shrink-0 snap-start flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors",
              day === d.iso
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground shadow-[var(--shadow-card)]",
              d.off && day !== d.iso && "opacity-50",
            )}
          >
            <span className="text-[12px] font-semibold uppercase">{d.label}</span>
            <span className="text-[18px] font-bold">{d.n}</span>
            <span className="flex h-2 gap-0.5">
              {Array.from({ length: Math.min(d.count, 3) }).map((_, i) => (
                <span key={i} className="size-1.5 rounded-full bg-accent" />
              ))}
            </span>
          </button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="surface px-5 py-8 text-center">
          <p className="text-[16px] font-semibold">No hay trabajos este día.</p>
          <Button className="mt-4" onClick={() => setAdding(true)}>
            <CalendarPlus className="size-5" /> Nuevo trabajo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {adding ? <NewJobSheet date={day} onClose={() => setAdding(false)} /> : null}
    </Screen>
  );
}
