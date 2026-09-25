import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Mic,
  Plus,
  Users,
  Receipt,
  ChevronRight,
  MapPin,
  ClipboardCheck,
  Sparkles,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Empty, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useAssistant } from "@/components/marcelo/assistant";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyTime, todayISO } from "@/lib/marcelo-data";
import { getInsights, type Insight } from "@/lib/marcelo-insights";
import {
  ClientAvatar,
  IconChip,
  ServiceIcon,
  toneBar,
  toneChip,
  type Tone,
} from "@/components/marcelo/visual";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marcelo — Tu asistente de trabajo" },
      {
        name: "description",
        content:
          "Marcelo organiza tu día, tus clientes y tu dinero. Háblale en español y él se encarga del resto.",
      },
      { property: "og:title", content: "Marcelo — Tu asistente de trabajo" },
      {
        property: "og:description",
        content:
          "Agenda, clientes, pagos y gastos en un solo lugar. Solo dile a Marcelo qué necesitas.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { state, clientById, togglePending } = useMarcelo();
  const { open } = useAssistant();
  const navigate = useNavigate();

  const today = state.jobs
    .filter((j) => j.date === todayISO())
    .sort((a, b) => a.time.localeCompare(b.time));
  const pendings = state.pendings.filter((p) => !p.done).slice(0, 4);
  const insights = getInsights(state);
  const newChats = state.conversations.filter((c) => c.unread || c.stage === "tu_turno");
  const bookedByMarcelo = state.conversations.filter((c) => c.stage === "agendado").length;
  const serviceKind = (name: string) => state.services.find((s) => s.name === name)?.kind;
  const go = (cta: Insight["cta"]) =>
    navigate({ to: cta.to, params: cta.params } as unknown as Parameters<typeof navigate>[0]);

  return (
    <Screen className="px-5 pt-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-tight">
            Hola{state.profile.name ? `, ${state.profile.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-[14px] font-medium text-muted-foreground">
            Aquí tienes tu resumen de hoy.
          </p>
        </div>
        <button onClick={() => navigate({ to: "/mas" })} aria-label="Tu perfil">
          <ClientAvatar
            name={state.profile.name || "?"}
            className="ring-2 ring-card shadow-[var(--shadow-card)]"
          />
        </button>
      </div>

      <button
        onClick={() => open()}
        className="relative w-full overflow-hidden rounded-[2rem] bg-primary px-6 py-7 text-center text-primary-foreground shadow-[var(--shadow-lift)] transition-transform active:scale-[0.99]"
      >
        <span className="absolute -right-12 -top-12 size-36 rounded-full bg-accent/15 blur-2xl" />
        <div className="relative flex flex-col items-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 text-accent">
            <Mic className="size-5" />
          </span>
          <span className="block text-[19px] font-bold">Habla con Marcelo</span>
          <span className="mt-1 block max-w-[260px] text-[13px] leading-relaxed text-primary-foreground/65">
            Di lo que necesitas en español. Yo me encargo del resto.
          </span>
          <span className="mt-5 flex size-14 items-center justify-center rounded-full bg-card text-accent shadow-[var(--shadow-card)]">
            <span className="absolute size-14 rounded-full bg-accent/25 animate-pulse-ring" />
            <Mic className="relative size-6" />
          </span>
        </div>
      </button>

      <div className="mt-7 grid grid-cols-4 gap-2">
        <QuickAction
          icon={Plus}
          tone="accent"
          label="Nueva cita"
          onClick={() => open("Agenda una cita")}
        />
        <QuickAction
          icon={Users}
          tone="teal"
          label="Clientes"
          onClick={() => navigate({ to: "/clientes" })}
        />
        <QuickAction
          icon={Receipt}
          tone="danger"
          label="Gasto"
          onClick={() => navigate({ to: "/gastos" })}
        />
        <QuickAction
          icon={ClipboardCheck}
          tone="plum"
          label="Pendientes"
          onClick={() => navigate({ to: "/pendientes" })}
        />
      </div>

      {newChats.length > 0 || bookedByMarcelo > 0 ? (
        <Card className="mt-4 flex items-center gap-3" onClick={() => navigate({ to: "/bandeja" })}>
          <IconChip icon={Bot} tone="success" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {newChats.length > 0
                ? `${newChats.length} ${newChats.length === 1 ? "mensaje nuevo" : "mensajes nuevos"} de clientes`
                : "Marcelo está contestando por ti"}
            </p>
            <p className="truncate text-[13px] text-muted-foreground">
              {bookedByMarcelo > 0
                ? `Ya agendó ${bookedByMarcelo} ${bookedByMarcelo === 1 ? "cita" : "citas"} solo`
                : `${newChats.map((c) => c.contactName.split(" ")[0]).join(", ")}`}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Card>
      ) : null}

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
                className="surface relative flex w-[250px] shrink-0 snap-start flex-col overflow-hidden p-4 text-left transition-transform active:scale-[0.98]"
              >
                <span className={cn("absolute inset-x-0 top-0 h-1", toneBar[tip.tone])} />
                <IconChip icon={tip.icon} tone={tip.tone} size="sm" />
                <p className="mt-3 text-[15px] font-semibold leading-snug">{tip.title}</p>
                <p className="mt-1 flex-1 text-[13px] leading-snug text-muted-foreground">
                  {tip.body}
                </p>
                <span
                  className={cn(
                    "mt-3 inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                    toneChip[tip.tone],
                  )}
                >
                  {tip.cta.label} <ChevronRight className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>Hoy</SectionTitle>
      {today.length === 0 ? (
        <Empty
          title="No tienes trabajos hoy."
          hint="Disfruta el día. Si quieres, dime a quién tienes que visitar y yo organizo tu agenda."
        />
      ) : (
        <div className="space-y-3">
          {today.map((job) => {
            const client = clientById(job.clientId);
            return (
              <Card
                key={job.id}
                className="p-5"
                onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } })}
              >
                <div className="flex items-start gap-3">
                  <ServiceIcon kind={serviceKind(job.service)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                      {prettyTime(job.time)}
                    </p>
                    <p className="mt-0.5 truncate text-[16px] font-semibold">
                      {client?.name ?? "Cliente"}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {job.service}
                    </p>
                    {client ? (
                      <p className="mt-2 flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
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
      )}

      <SectionTitle
        action={
          <button
            onClick={() => navigate({ to: "/pendientes" })}
            className="flex items-center gap-0.5 text-[13px] font-medium text-accent"
          >
            Ver todo <ChevronRight className="size-3.5" />
          </button>
        }
      >
        Pendientes
      </SectionTitle>
      {pendings.length === 0 ? (
        <Empty title="Todo al día." hint="No tienes nada pendiente por ahora." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {pendings.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePending(p.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <span className="size-5 shrink-0 rounded-md border-2 border-border" />
              <span className="flex-1 text-[15px]">{p.text}</span>
            </button>
          ))}
        </Card>
      )}

      <div className="mt-6">
        <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/dinero" })}>
          Ver tu dinero
        </Button>
      </div>
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
      className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card px-1 py-3 text-center text-[10px] font-semibold text-foreground shadow-[var(--shadow-card)] transition-transform active:scale-95"
    >
      <span className={cn("flex size-9 items-center justify-center rounded-xl", toneChip[tone])}>
        <Icon className="size-4" />
      </span>
      <span className="w-full truncate">{label}</span>
    </button>
  );
}
