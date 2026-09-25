import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Phone, MessageSquare, CalendarPlus, MapPin } from "lucide-react";
import { Badge, Button, Card, Field, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyDate, prettyTime, todayISO } from "@/lib/marcelo-data";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes/$clientId")({
  head: () => ({
    meta: [
      { title: "Ficha de cliente — Marcelo" },
      { name: "description", content: "Datos del cliente, trabajos próximos, historial y lo que te debe." },
      { property: "og:title", content: "Ficha de cliente — Marcelo" },
      { property: "og:description", content: "Datos del cliente, trabajos próximos y lo que te debe." },
    ],
  }),
  component: ClienteDetalle,
});

function ClienteDetalle() {
  const { clientId } = useParams({ from: "/clientes/$clientId" });
  const { state, clientById, addJob } = useMarcelo();
  const navigate = useNavigate();
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState(todayISO(1));
  const [time, setTime] = useState("09:00");

  const client = clientById(clientId);
  if (!client) {
    return (
      <Screen>
        <p className="text-[15px] text-muted-foreground">No encontré ese cliente.</p>
      </Screen>
    );
  }

  const jobs = state.jobs.filter((j) => j.clientId === client.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const upcoming = jobs.filter((j) => j.date >= todayISO());
  const past = jobs.filter((j) => j.date < todayISO());
  const owed = state.pendings
    .filter((p) => !p.done && p.clientId === client.id && p.amount)
    .reduce((a, b) => a + (b.amount ?? 0), 0);

  return (
    <Screen>
      <button onClick={() => navigate({ to: "/clientes" })} className="mb-4 flex items-center gap-1.5 text-[14px] text-muted-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </button>

      <h1 className="text-[24px] font-semibold leading-tight">{client.name}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {client.service}
        {client.price ? ` · ${money(client.price)} habitual` : ""}
      </p>
      {owed > 0 ? (
        <div className="mt-3">
          <Badge tone="danger">Te debe {money(owed)}</Badge>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={() => (window.location.href = `tel:${client.phone}`)}>
          <Phone className="size-4" /> Llamar
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/mensaje/$clientId", params: { clientId: client.id } })}>
          <MessageSquare className="size-4" /> Mensaje
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setScheduling((v) => !v)}>
          <CalendarPlus className="size-4" /> Cita
        </Button>
      </div>

      {scheduling ? (
        <Card className="mt-4 space-y-3">
          <p className="text-[15px] font-semibold">Nueva cita</p>
          <p className="text-[13px] text-muted-foreground">
            Ya sé la dirección, el servicio y el precio. Solo elige el día y la hora.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Día" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Field label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              const job = addJob({
                clientId: client.id,
                date,
                time,
                service: client.service,
                price: client.price,
                status: "confirmado",
              });
              setScheduling(false);
              toast.success("Cita agendada");
              navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } });
            }}
          >
            Agendar
          </Button>
        </Card>
      ) : null}

      <SectionTitle>Datos</SectionTitle>
      <Card className="space-y-3">
        <InfoLine label="Teléfono" value={client.phone || "Sin teléfono"} />
        <InfoLine label="Dirección" value={`${client.address}${client.city ? `, ${client.city}` : ""}`} icon />
        {client.notes ? <InfoLine label="Notas" value={client.notes} /> : null}
      </Card>

      <SectionTitle>Próximos trabajos</SectionTitle>
      {upcoming.length === 0 ? (
        <Card className="py-6 text-center text-[14px] text-muted-foreground">Sin trabajos agendados.</Card>
      ) : (
        <div className="space-y-3">
          {upcoming.map((j) => (
            <Card key={j.id} onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: j.id } })}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-accent">
                    {prettyDate(j.date)} · {prettyTime(j.time)}
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold">{j.service}</p>
                </div>
                <p className="text-[15px] font-semibold">{money(j.price)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Trabajos anteriores</SectionTitle>
      {past.length === 0 ? (
        <Card className="py-6 text-center text-[14px] text-muted-foreground">Todavía no hay historial.</Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {past.map((j) => (
            <div key={j.id} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-[14px] font-medium">{j.service}</p>
                <p className="text-[12px] text-muted-foreground">{prettyDate(j.date)}</p>
              </div>
              <p className="text-[14px] font-semibold">{money(j.price)}</p>
            </div>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function InfoLine({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[15px]">
        {icon ? <MapPin className="size-4 text-muted-foreground" /> : null}
        {value}
      </p>
    </div>
  );
}
