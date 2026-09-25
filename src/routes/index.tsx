import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, Plus, UserPlus, Receipt, ChevronRight, MapPin } from "lucide-react";
import { Badge, Button, Card, Empty, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useAssistant } from "@/components/marcelo/assistant";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyTime, todayISO } from "@/lib/marcelo-data";

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
        content: "Agenda, clientes, pagos y gastos en un solo lugar. Solo dile a Marcelo qué necesitas.",
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

  return (
    <Screen>
      <div className="mb-5">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
          Hola, {state.profile.name.split(" ")[0] || "Carlos"}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Aquí tienes tu día.</p>
      </div>

      <button
        onClick={() => open()}
        className="w-full rounded-2xl bg-primary p-5 text-left text-primary-foreground shadow-[var(--shadow-lift)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">Marcelo</p>
        <div className="mt-3 flex items-center gap-4">
          <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10">
            <span className="absolute inset-0 rounded-full bg-accent/40 animate-pulse-ring" />
            <Mic className="relative size-6" />
          </span>
          <span>
            <span className="block text-[17px] font-semibold">Habla con Marcelo</span>
            <span className="mt-0.5 block text-[13px] leading-relaxed text-primary-foreground/75">
              Cuéntame qué necesitas y yo me encargo.
            </span>
          </span>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickAction icon={<Plus className="size-4" />} label="Nueva cita" onClick={() => open("Agenda una cita")} />
        <QuickAction
          icon={<UserPlus className="size-4" />}
          label="Cliente"
          onClick={() => navigate({ to: "/clientes" })}
        />
        <QuickAction icon={<Receipt className="size-4" />} label="Gasto" onClick={() => navigate({ to: "/gastos" })} />
      </div>

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
              <Card key={job.id} onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } })}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-accent">{prettyTime(job.time)}</p>
                    <p className="mt-0.5 truncate text-[16px] font-semibold">{client?.name ?? "Cliente"}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{job.service}</p>
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

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-[12px] font-medium text-foreground"
    >
      <span className="text-accent">{icon}</span>
      {label}
    </button>
  );
}
