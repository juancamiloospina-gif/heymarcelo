import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  History,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import { Button, Card, PageTitle, Screen } from "@/components/marcelo/kit";
import { JobCard, NewJobSheet } from "@/components/marcelo/jobs";
import { useMarcelo } from "@/lib/marcelo-store";
import { dayShort, isActiveJob, isDoneJob, prettyDate, todayISO } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Marcelo" },
      { name: "description", content: "Tus trabajos día por día." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { trabajo?: string } =>
    typeof s["trabajo"] === "string" ? { trabajo: s["trabajo"] } : {},
  component: Agenda,
});

/** Seven days at a time (always fits the phone); three weeks ahead, as before. */
const WEEKS = 3;

/** "Martes, 20 de octubre" (prettyDate says only "Hoy" / "Mañana" for the next days). */
const longDate = (iso: string) => {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const roundBtn = "size-12 shrink-0 rounded-full p-0 shadow-[var(--shadow-card)]";

function Agenda() {
  const { state } = useMarcelo();
  const navigate = useNavigate();
  const { trabajo } = Route.useSearch();
  const [day, setDay] = useState(todayISO());
  const [week, setWeek] = useState(0);
  const [adding, setAdding] = useState(Boolean(trabajo));

  const visible = (d: string) =>
    state.jobs.filter((j) => j.date === d && (isActiveJob(j) || isDoneJob(j)));
  const jobs = visible(day).sort((a, b) => a.time.localeCompare(b.time));
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = todayISO(week * 7 + i);
    const d = new Date(`${iso}T12:00:00`);
    return {
      iso,
      label: dayShort[d.getDay()],
      n: d.getDate(),
      count: visible(iso).length,
      off: !state.settings.hours[d.getDay()]?.on || state.settings.blocked.includes(iso),
    };
  });
  // What comes after the selected day, so an empty day is never a dead end.
  const upcoming = state.jobs
    .filter((j) => j.date > day && isActiveJob(j))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 3);

  const goWeek = (w: number) => {
    const next = Math.max(0, Math.min(WEEKS - 1, w));
    setWeek(next);
    setDay(todayISO(next * 7));
  };

  return (
    <Screen>
      <PageTitle
        title="Agenda"
        subtitle={`${day === todayISO() ? "Hoy · " : ""}${longDate(day)}`}
        right={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className={roundBtn}
              aria-label="Servicios realizados"
              onClick={() => navigate({ to: "/realizados" })}
            >
              <History className="size-5" />
            </Button>
            <Button
              variant="secondary"
              className={roundBtn}
              aria-label="Clientes"
              onClick={() => navigate({ to: "/clientes" })}
            >
              <Users className="size-5" />
            </Button>
            <Button className={roundBtn} aria-label="Nuevo trabajo" onClick={() => setAdding(true)}>
              <CalendarPlus className="size-5" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => setDay(d.iso)}
            aria-pressed={day === d.iso}
            aria-label={`${prettyDate(d.iso)}, ${d.count} trabajos`}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors",
              day === d.iso
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                : "bg-card text-foreground shadow-[var(--shadow-card)]",
              d.off && day !== d.iso && "opacity-50",
            )}
          >
            <span className="text-[11px] font-semibold uppercase">{d.label}</span>
            <span className="text-[19px] font-bold leading-none">{d.n}</span>
            <span className="flex h-2 gap-0.5">
              {Array.from({ length: Math.min(d.count, 3) }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full",
                    day === d.iso ? "bg-primary-foreground" : "bg-accent",
                  )}
                />
              ))}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 mt-4 flex items-center justify-between border-t border-border pt-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {longDate(day)}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => goWeek(week - 1)}
            disabled={week === 0}
            aria-label="Semana anterior"
            className="flex size-9 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)] disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={() => goWeek(week + 1)}
            disabled={week >= WEEKS - 1}
            aria-label="Semana siguiente"
            className="flex size-9 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)] disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card className="rounded-[1.5rem] px-5 py-7 text-center">
          <span className="relative mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-brand-soft text-sky">
            <CalendarDays className="size-11" strokeWidth={1.5} />
            <Sparkles className="absolute -right-1 top-0 size-5 text-accent" strokeWidth={1.8} />
          </span>
          <p className="text-[20px] font-extrabold">No hay trabajos este día</p>
          <p className="mx-auto mt-1 max-w-[260px] text-[15px] text-muted-foreground">
            Cuando agendes un trabajo, aparecerá aquí.
          </p>
          <Button className="mt-4 rounded-full px-6" onClick={() => setAdding(true)}>
            <CalendarPlus className="size-5" /> Nuevo trabajo
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {upcoming.length > 0 ? (
        <>
          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em]">
            Próximamente
          </h2>
          <div className="space-y-3">
            {upcoming.map((job) => (
              <JobCard key={job.id} job={job} showDate />
            ))}
          </div>
        </>
      ) : jobs.length === 0 ? (
        <>
          <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em]">
            Para organizarte
          </h2>
          <div className="space-y-2">
            <Shortcut
              icon={CalendarDays}
              tint="brand"
              title="Organiza tu semana"
              body="Revisa tus próximos días y mantén tu agenda al día."
              onClick={() => goWeek(week + 1)}
            />
            <Shortcut
              icon={ListChecks}
              tint="peach"
              title="Revisa tus pendientes"
              body="No dejes nada por fuera."
              onClick={() => navigate({ to: "/pendientes" })}
            />
          </div>
        </>
      ) : null}

      {adding ? (
        <NewJobSheet
          date={day}
          clientId={trabajo && trabajo !== "-" ? trabajo : undefined}
          onClose={() => {
            setAdding(false);
            if (trabajo) navigate({ to: "/agenda", search: {}, replace: true });
          }}
        />
      ) : null}
    </Screen>
  );
}

function Shortcut({
  icon: Icon,
  tint,
  title,
  body,
  onClick,
}: {
  icon: typeof CalendarDays;
  tint: "brand" | "peach";
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <Card className="flex items-center gap-3 rounded-[1.25rem] p-3.5" onClick={onClick}>
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full",
          tint === "brand" ? "bg-brand-soft text-sky" : "bg-peach text-accent",
        )}
      >
        <Icon className="size-6" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold">{title}</span>
        <span className="block text-[14px] leading-snug text-muted-foreground">{body}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" aria-hidden />
    </Card>
  );
}
