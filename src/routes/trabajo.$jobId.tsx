import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Phone, Map, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyDate, prettyTime, todayISO } from "@/lib/marcelo-data";

export const Route = createFileRoute("/trabajo/$jobId")({
  head: () => ({
    meta: [
      { title: "Detalle del trabajo — Marcelo" },
      { name: "description", content: "Hora, dirección, precio y cobro del trabajo, sin pasos de más." },
      { property: "og:title", content: "Detalle del trabajo — Marcelo" },
      { property: "og:description", content: "Hora, dirección, precio y cobro del trabajo." },
    ],
  }),
  component: TrabajoDetalle,
});

const methods = [
  { key: "efectivo", label: "Efectivo" },
  { key: "zelle", label: "Zelle / Venmo" },
  { key: "cheque", label: "Cheque" },
  { key: "debe", label: "Me quedó debiendo" },
] as const;

function TrabajoDetalle() {
  const { jobId } = useParams({ from: "/trabajo/$jobId" });
  const { state, clientById, updateJob, addPayment, addPending } = useMarcelo();
  const navigate = useNavigate();
  const [charging, setCharging] = useState(false);

  const job = state.jobs.find((j) => j.id === jobId);
  const client = clientById(job?.clientId);

  if (!job) {
    return (
      <Screen>
        <p className="text-[15px] text-muted-foreground">No encontré ese trabajo.</p>
      </Screen>
    );
  }

  const complete = (method: (typeof methods)[number]["key"]) => {
    updateJob(job.id, { status: "completado" });
    if (method === "debe") {
      addPending(`${client?.name ?? "El cliente"} me debe ${money(job.price)}`, {
        clientId: job.clientId,
        amount: job.price,
      });
      toast.success("Anotado como pendiente de cobro");
    } else {
      addPayment({ clientId: job.clientId, jobId: job.id, amount: job.price, method, date: todayISO() });
      toast.success(`Cobro registrado: ${money(job.price)}`);
    }
    setCharging(false);
  };

  return (
    <Screen>
      <button onClick={() => navigate({ to: "/agenda" })} className="mb-5 flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
        <ArrowLeft className="size-4" /> Crear un trabajo
      </button>

      <h1 className="text-[24px] font-semibold leading-tight">{client?.name ?? "Cliente"}</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">{job.service}</p>

      <Card className="mt-5 space-y-4 border-l-4 border-l-accent">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Cuándo</p>
            <p className="mt-0.5 text-[16px] font-semibold">
              {prettyDate(job.date)} · {prettyTime(job.time)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Precio</p>
            <p className="mt-0.5 text-[16px] font-semibold">{money(job.price)}</p>
          </div>
        </div>
        {client ? (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Dónde</p>
            <p className="mt-0.5 text-[15px]">
              {client.address}
              <br />
              {client.city}
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</p>
          <div className="mt-1.5">
            {job.status === "completado" ? (
              <Badge tone="success">Completado</Badge>
            ) : job.status === "confirmado" ? (
              <Badge tone="neutral">Confirmado</Badge>
            ) : (
              <Badge tone="warning">Por confirmar</Badge>
            )}
          </div>
        </div>
      </Card>

      <SectionTitle>Acciones</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            window.open(
              `https://maps.google.com/?q=${encodeURIComponent(`${client?.address ?? ""} ${client?.city ?? ""}`)}`,
              "_blank",
            )
          }
        >
          <Map className="size-4" /> Mapa
        </Button>
        <Button variant="secondary" size="sm" onClick={() => (window.location.href = `tel:${client?.phone ?? ""}`)}>
          <Phone className="size-4" /> Llamar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => client && navigate({ to: "/mensaje/$clientId", params: { clientId: client.id } })}
        >
          <MessageSquare className="size-4" /> Mensaje
        </Button>
      </div>

      {job.status !== "completado" ? (
        <div className="mt-5">
          {charging ? (
            <Card className="space-y-3">
              <p className="text-[15px] font-semibold">
                {client?.name} · {money(job.price)}
              </p>
              <p className="text-[13px] text-muted-foreground">¿Cómo pagó el cliente?</p>
              <div className="grid grid-cols-2 gap-2">
                {methods.map((m) => (
                  <Button key={m.key} variant="secondary" size="sm" onClick={() => complete(m.key)}>
                    {m.label}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setCharging(false)}>
                Cancelar
              </Button>
            </Card>
          ) : (
            <Button variant="accent" className="w-full" onClick={() => setCharging(true)}>
              <CheckCircle2 className="size-4" /> Completar y cobrar
            </Button>
          )}
        </div>
      ) : null}
    </Screen>
  );
}
