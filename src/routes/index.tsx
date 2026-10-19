import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Banknote,
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Languages,
  Receipt,
  Sparkles,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";
import character from "@/assets/marcelo-character.png";
import { Card, Empty, Screen, SectionTitle } from "@/components/marcelo/kit";
import { AttentionList } from "@/components/marcelo/attention";
import { JobCard, NewJobSheet, PaymentSheet } from "@/components/marcelo/jobs";
import { ReminderRow } from "@/components/marcelo/reminders";
import { useMarcelo } from "@/lib/marcelo-store";
import { isActiveJob, todayISO } from "@/lib/marcelo-data";
import { getInsights, type Insight } from "@/lib/marcelo-insights";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marcelo — Tu asistente de trabajo" },
      {
        name: "description",
        content: "Marcelo organiza tu día, tus clientes y tu dinero. Háblale en español.",
      },
      { property: "og:title", content: "Marcelo — Tu asistente de trabajo" },
      {
        property: "og:description",
        content: "Trabajos, clientes, cobros y gastos en un solo lugar.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { state } = useMarcelo();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<"job" | "paid" | null>(null);

  const today = state.jobs
    .filter(
      (j) =>
        j.date === todayISO() && (isActiveJob(j) || j.status === "hecho" || j.status === "cobrado"),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const reminders = state.pendings.filter((p) => !p.done).slice(0, 4);
  const insights = getInsights(state);
  const go = (cta: Insight["cta"]) =>
    navigate({ to: cta.to, params: cta.params } as unknown as Parameters<typeof navigate>[0]);
  const first = state.profile.name.split(" ")[0];

  return (
    <Screen className="px-5 pt-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src={character} alt="" aria-hidden className="size-10 object-contain" />
          <span className="text-[24px] font-extrabold tracking-tight text-foreground">Marcelo</span>
        </div>
        <button
          onClick={() => navigate({ to: "/configuracion" })}
          aria-label="Perfil y configuración"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sky ring-2 ring-card shadow-[var(--shadow-card)]"
        >
          <User className="size-6" strokeWidth={1.8} />
        </button>
      </div>

      <div className="mb-6">
        <h1 className="truncate text-[30px] font-extrabold leading-tight tracking-tight text-foreground">
          Hola{first ? `, ${first}` : ""}
        </h1>
        <p className="mt-1 text-[16px] text-muted-foreground">
          {today.length
            ? `Hoy tienes ${today.length} ${today.length === 1 ? "trabajo" : "trabajos"}.`
            : "Hoy no tienes trabajos."}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2">
        <QuickAction icon={CalendarPlus} label="Nuevo trabajo" onClick={() => setSheet("job")} />
        <QuickAction icon={Banknote} label="Cobré" onClick={() => setSheet("paid")} />
        <QuickAction
          icon={Receipt}
          label="Anotar gasto"
          onClick={() => navigate({ to: "/dinero", search: { tab: "gastos" } })}
        />
        <QuickAction
          icon={Languages}
          label="Traducir"
          onClick={() => navigate({ to: "/traducir" })}
        />
      </div>

      <AttentionList />

      <SectionTitle
        action={
          <button
            onClick={() => navigate({ to: "/agenda" })}
            className="flex h-10 items-center text-[15px] font-semibold text-sky"
          >
            Agenda <ChevronRight className="size-4" />
          </button>
        }
      >
        Hoy
      </SectionTitle>
      {today.length === 0 ? (
        <Empty
          title="No tienes trabajos hoy."
          hint="Toca Nuevo trabajo o díselo a Marcelo con el micrófono."
          className="border-sky/15 bg-gradient-to-br from-brand-soft to-card"
          icon={
            <span className="relative flex size-14 items-center justify-center text-sky">
              <CalendarDays className="size-11" strokeWidth={1.5} />
              <Sparkles className="absolute -right-2 -top-1 size-5 text-accent" strokeWidth={1.8} />
            </span>
          }
        />
      ) : (
        <div className="space-y-3">
          {today.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <SectionTitle
        lead={<Bell className="size-4 text-accent" strokeWidth={2.2} />}
        action={
          <button
            onClick={() => navigate({ to: "/pendientes" })}
            className="flex h-10 items-center text-[15px] font-semibold text-sky"
          >
            Ver todos <ChevronRight className="size-4" />
          </button>
        }
      >
        Recordatorios
      </SectionTitle>
      {reminders.length === 0 ? (
        <Empty title="Todo al día." hint="No tienes recordatorios." />
      ) : (
        <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
          {reminders.map((p) => (
            <ReminderRow key={p.id} pending={p} />
          ))}
        </Card>
      )}

      {insights.length > 0 ? (
        <>
          <SectionTitle lead={<Star className="size-4 fill-accent text-accent" />}>
            Marcelo te recomienda
          </SectionTitle>
          <div className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-2">
            {insights.map((tip, i) => {
              const warm = i % 2 === 1;
              const Icon = tip.icon;
              return (
                <button
                  key={tip.id}
                  onClick={() => go(tip.cta)}
                  className={cn(
                    "relative flex shrink-0 snap-start flex-col overflow-hidden rounded-[1.25rem] border p-3.5 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]",
                    insights.length === 1 ? "w-full" : "w-[calc(50%-0.375rem)] min-w-[158px]",
                    warm
                      ? "border-accent/15 bg-gradient-to-br from-peach to-card"
                      : "border-sky/15 bg-gradient-to-br from-brand-soft to-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)]",
                      warm ? "text-accent" : "text-sky",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <p className="mt-3 text-[15px] font-bold leading-snug text-foreground">
                    {tip.title}
                  </p>
                  <p className="mt-1 flex-1 text-[13px] leading-snug text-muted-foreground">
                    {tip.body}
                  </p>
                  <span
                    className={cn(
                      "mt-3 inline-flex min-h-9 w-fit max-w-full items-center gap-0.5 rounded-full bg-card py-1.5 pl-3 pr-2 text-[13px] font-bold shadow-[var(--shadow-card)]",
                      warm ? "text-accent" : "text-sky",
                    )}
                  >
                    <span className="truncate">{tip.cta.label}</span>
                    <ChevronRight className="size-4 shrink-0" />
                  </span>
                  {i === 0 ? (
                    <img
                      src={character}
                      alt=""
                      aria-hidden
                      className="-mb-3.5 -mr-1 mt-1 size-[84px] self-end object-contain"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {sheet === "job" ? <NewJobSheet onClose={() => setSheet(null)} /> : null}
      {sheet === "paid" ? <PaymentSheet onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[96px] min-w-0 flex-col items-center justify-start gap-2 rounded-[1.25rem] border border-border/60 bg-card px-1 pb-3 pt-3.5 text-center text-[13px] font-semibold leading-tight text-foreground shadow-[var(--shadow-card)] transition-transform active:scale-95"
    >
      <span className="relative flex size-11 items-center justify-center text-sky">
        <Icon className="size-8" strokeWidth={1.6} />
        <span className="absolute right-0 top-0.5 size-2 rounded-full bg-accent" aria-hidden />
      </span>
      <span className="w-full">{label}</span>
    </button>
  );
}
