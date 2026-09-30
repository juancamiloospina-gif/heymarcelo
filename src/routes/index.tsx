import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Banknote,
  CalendarPlus,
  ChevronRight,
  Languages,
  Receipt,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card, Empty, Screen, SectionTitle } from "@/components/marcelo/kit";
import { AttentionList } from "@/components/marcelo/attention";
import { JobCard, NewJobSheet, PaymentSheet } from "@/components/marcelo/jobs";
import { ReminderRow } from "@/components/marcelo/reminders";
import { ClientAvatar, IconChip, toneBar, toneChip, type Tone } from "@/components/marcelo/visual";
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold leading-tight">
            Hola{first ? `, ${first}` : ""}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {today.length
              ? `Hoy tienes ${today.length} ${today.length === 1 ? "trabajo" : "trabajos"}.`
              : "Hoy no tienes trabajos."}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/configuracion" })}
          aria-label="Perfil y configuración"
        >
          <ClientAvatar
            name={state.profile.name || "?"}
            className="ring-2 ring-card shadow-[var(--shadow-card)]"
          />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2">
        <QuickAction
          icon={CalendarPlus}
          tone="accent"
          label="Nuevo trabajo"
          onClick={() => setSheet("job")}
        />
        <QuickAction
          icon={Banknote}
          tone="success"
          label="Cobré"
          onClick={() => setSheet("paid")}
        />
        <QuickAction
          icon={Receipt}
          tone="danger"
          label="Anotar gasto"
          onClick={() => navigate({ to: "/dinero", search: { tab: "gastos" } })}
        />
        <QuickAction
          icon={Languages}
          tone="sky"
          label="Traducir"
          onClick={() => navigate({ to: "/traducir" })}
        />
      </div>

      <AttentionList />

      <SectionTitle
        action={
          <button
            onClick={() => navigate({ to: "/agenda" })}
            className="flex h-10 items-center text-[15px] font-semibold text-accent"
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
        />
      ) : (
        <div className="space-y-3">
          {today.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <SectionTitle
        action={
          <button
            onClick={() => navigate({ to: "/pendientes" })}
            className="flex h-10 items-center text-[15px] font-semibold text-accent"
          >
            Ver todo <ChevronRight className="size-4" />
          </button>
        }
      >
        Recordatorios
      </SectionTitle>
      {reminders.length === 0 ? (
        <Empty title="Todo al día." hint="No tienes recordatorios." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {reminders.map((p) => (
            <ReminderRow key={p.id} pending={p} />
          ))}
        </Card>
      )}

      {insights.length > 0 ? (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-accent" /> Marcelo te recomienda
            </span>
          </SectionTitle>
          <div className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
            {insights.map((tip) => (
              <button
                key={tip.id}
                onClick={() => go(tip.cta)}
                className="surface relative flex w-[260px] shrink-0 snap-start flex-col overflow-hidden p-4 text-left active:scale-[0.98]"
              >
                <span className={cn("absolute inset-x-0 top-0 h-1", toneBar[tip.tone])} />
                <IconChip icon={tip.icon} tone={tip.tone} size="sm" />
                <p className="mt-3 text-[16px] font-semibold leading-snug">{tip.title}</p>
                <p className="mt-1 flex-1 text-[14px] leading-snug text-muted-foreground">
                  {tip.body}
                </p>
                <span
                  className={cn(
                    "mt-3 inline-flex w-fit items-center gap-1 rounded-full px-3 py-2 text-[14px] font-semibold",
                    toneChip[tip.tone],
                  )}
                >
                  {tip.cta.label} <ChevronRight className="size-4" />
                </span>
              </button>
            ))}
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
  tone,
  label,
  onClick,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-1 py-3 text-center text-[13px] font-semibold leading-tight text-foreground shadow-[var(--shadow-card)] active:scale-95"
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", toneChip[tone])}>
        <Icon className="size-5" />
      </span>
      <span className="w-full">{label}</span>
    </button>
  );
}
