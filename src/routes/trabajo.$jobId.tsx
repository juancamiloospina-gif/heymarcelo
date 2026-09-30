import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { BellRing, Check, FileText, Languages, Navigation, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BackButton, Button, Card, Screen, SectionTitle } from "@/components/marcelo/kit";
import { JobCard } from "@/components/marcelo/jobs";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyDate, statusLabel, type JobStatus } from "@/lib/marcelo-data";
import { shareInvoice } from "@/lib/reports";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trabajo/$jobId")({
  head: () => ({
    meta: [
      { title: "Trabajo — Marcelo" },
      { name: "description", content: "Hora, dirección, precio y cobro del trabajo." },
    ],
  }),
  component: TrabajoDetalle,
});

const flow: JobStatus[] = ["cotizado", "confirmado", "en_camino", "hecho", "cobrado"];

function TrabajoDetalle() {
  const { jobId } = useParams({ from: "/trabajo/$jobId" });
  const { state, clientById, updateJob, queueJobMessage } = useMarcelo();
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const job = state.jobs.find((j) => j.id === jobId);
  const client = clientById(job?.clientId);
  if (!job) {
    return (
      <Screen>
        <BackButton />
        <p className="text-[16px] text-muted-foreground">No encontré ese trabajo.</p>
      </Screen>
    );
  }

  const step = flow.indexOf(job.status);
  const hoursLeft = job.expiresAt
    ? Math.max(0, Math.round((new Date(job.expiresAt).getTime() - Date.now()) / 3_600_000))
    : null;
  const miles = state.miles.filter((m) => m.jobId === job.id).reduce((a, b) => a + b.miles, 0);
  const first = client?.name.split(" ")[0] ?? "el cliente";
  const hasPhone = Boolean(client?.phone);

  const messages = [
    {
      kind: "confirm" as const,
      label: "Confirmación",
      done: job.sent?.confirm,
      show: job.status !== "cotizado",
    },
    {
      kind: "reminder" as const,
      label: "Recordatorio 24 h antes",
      done: job.sent?.reminder,
      show: job.status === "confirmado",
    },
    {
      kind: "onTheWay" as const,
      label: "Voy en camino",
      done: job.sent?.onTheWay,
      show: job.status === "confirmado" || job.status === "en_camino",
    },
  ];

  return (
    <Screen>
      <BackButton onClick={() => navigate({ to: "/agenda" })} label="Agenda" />
      <JobCard job={job} showDate />

      {job.status !== "cancelado" && job.status !== "vencido" ? (
        <div
          className="mt-4 flex items-center gap-1"
          aria-label={`Estado: ${statusLabel[job.status]}`}
        >
          {flow.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn("h-1.5 w-full rounded-full", i <= step ? "bg-accent" : "bg-muted")}
              />
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  i === step ? "text-accent" : "text-muted-foreground",
                )}
              >
                {statusLabel[s]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Card className="mt-4 text-[15px] text-muted-foreground">
          Este trabajo está {statusLabel[job.status].toLowerCase()}.
        </Card>
      )}

      {job.status === "cotizado" && hoursLeft !== null ? (
        <Card className="mt-4 flex items-center gap-3 border-warning/30 bg-warning/10">
          <Timer className="size-5 text-warning-foreground" />
          <p className="text-[15px] text-warning-foreground">
            La cotización vence en {hoursLeft} h. Marcelo le escribirá una vez si no contesta.
          </p>
        </Card>
      ) : null}

      <SectionTitle>Mensajes a {first}</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {messages
          .filter((m) => m.show)
          .map((m) => (
            <div key={m.kind} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <BellRing className="size-5 text-muted-foreground" />
              <span className="flex-1 text-[16px]">{m.label}</span>
              {m.done ? (
                <span className="flex items-center gap-1 text-[14px] font-semibold text-success">
                  <Check className="size-4" /> Listo
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!hasPhone}
                  onClick={() => queueJobMessage(m.kind, job.id, "ask")}
                >
                  Preparar
                </Button>
              )}
            </div>
          ))}
        {job.status === "hecho" || job.status === "cobrado" ? (
          <div className="flex min-h-14 items-center gap-3 px-4 py-2">
            <FileText className="size-5 text-muted-foreground" />
            <span className="flex-1 text-[16px]">Factura en inglés</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const shared = await shareInvoice(state, job);
                if (hasPhone) queueJobMessage("invoice", job.id, "ask");
                toast.success(shared ? "Factura lista para compartir" : "Factura descargada");
              }}
            >
              Enviar
            </Button>
          </div>
        ) : null}
      </Card>
      {!hasPhone ? (
        <p className="mt-2 text-[14px] text-muted-foreground">
          Agrega el teléfono del cliente para enviarle mensajes.
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        <Button
          className="bg-sky text-white hover:bg-sky/90"
          onClick={() => navigate({ to: "/traducir", search: { clientId: job.clientId } })}
        >
          <Languages className="size-5" /> Traducir con {first}
        </Button>
        {miles > 0 ? (
          <p className="flex items-center justify-center gap-1.5 text-[14px] text-muted-foreground">
            <Navigation className="size-4" /> {miles} millas registradas
          </p>
        ) : null}
      </div>

      <SectionTitle>Detalles</SectionTitle>
      <Card className="space-y-2 text-[16px]">
        <p>
          <span className="text-muted-foreground">Día: </span>
          {prettyDate(job.date)}
        </p>
        <p>
          <span className="text-muted-foreground">Precio: </span>
          {money(job.price)}
        </p>
      </Card>

      {job.status === "cotizado" || job.status === "confirmado" ? (
        confirmCancel ? (
          <Card className="mt-4 space-y-3 border-destructive/30">
            <p className="text-[16px] font-semibold">¿Cancelar este trabajo?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                No
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const before = job.status;
                  updateJob(job.id, { status: "cancelado" });
                  toast("Trabajo cancelado", {
                    action: {
                      label: "Deshacer",
                      onClick: () => updateJob(job.id, { status: before }),
                    },
                  });
                  setConfirmCancel(false);
                }}
              >
                Sí, cancelar
              </Button>
            </div>
          </Card>
        ) : (
          <Button
            variant="ghost"
            className="mt-4 w-full text-destructive"
            onClick={() => setConfirmCancel(true)}
          >
            <XCircle className="size-5" /> Cancelar trabajo
          </Button>
        )
      ) : null}
    </Screen>
  );
}
