import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  HandCoins,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Receipt,
  Route as RouteIcon,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Chips, Field, Sheet } from "./kit";
import { ClientAvatar, ServiceIcon } from "./visual";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  digits,
  money,
  paymentMethodLabel,
  paymentMethods,
  prettyDate,
  prettyTime,
  priceFor,
  sizeLabel,
  statusLabel,
  todayISO,
  type Client,
  type Job,
  type JobStatus,
  type PaymentMethod,
  type Size,
} from "@/lib/marcelo-data";
import { endTripFor, hasTrip, startTripFor } from "@/lib/trips";
import { cn } from "@/lib/utils";

export const statusTone: Record<JobStatus, "neutral" | "success" | "warning" | "danger"> = {
  consulta: "neutral",
  cotizado: "warning",
  confirmado: "neutral",
  en_camino: "warning",
  hecho: "danger",
  cobrado: "success",
  vencido: "neutral",
  cancelado: "neutral",
};

const methodIcon: Record<PaymentMethod, typeof Banknote> = {
  efectivo: Banknote,
  zelle: Smartphone,
  cashapp: Wallet,
  cheque: Receipt,
  tarjeta: CreditCard,
};

export const whatsappUrl = (phone: string) => {
  const d = digits(phone);
  return d ? `https://wa.me/1${d}` : "";
};

export const jobAddress = (job: Job, client?: Client) =>
  job.address || [client?.address, client?.city].filter(Boolean).join(", ");

/** Card for a job: status, who/where/when, and the four actions used on site. */
export function JobCard({ job, showDate = false }: { job: Job; showDate?: boolean }) {
  const { state, clientById } = useMarcelo();
  const navigate = useNavigate();
  const [going, setGoing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const client = clientById(job.clientId);
  const kind = state.services.find((s) => s.id === job.serviceId || s.name === job.service)?.kind;
  const address = jobAddress(job, client);
  const open =
    job.status === "confirmado" || job.status === "en_camino" || job.status === "cotizado";

  return (
    <Card className="p-0">
      <button
        onClick={() => navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } })}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <ServiceIcon kind={kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] font-bold text-accent">
              {showDate ? `${prettyDate(job.date)} · ` : ""}
              {prettyTime(job.time)}
            </p>
            <p className="text-[17px] font-bold">{money(job.price)}</p>
          </div>
          <p className="mt-0.5 truncate text-[17px] font-semibold">{client?.name ?? "Cliente"}</p>
          <p className="truncate text-[15px] text-muted-foreground">{job.service}</p>
          {address ? (
            <p className="mt-1 flex items-center gap-1.5 truncate text-[14px] text-muted-foreground">
              <MapPin className="size-4 shrink-0" /> {address}
            </p>
          ) : null}
          <div className="mt-2">
            <Badge tone={statusTone[job.status]}>{statusLabel[job.status]}</Badge>
          </div>
        </div>
      </button>
      {open ? (
        <div className="grid grid-cols-4 border-t">
          <ActionLink
            href={client?.phone ? `tel:${client.phone}` : ""}
            icon={Phone}
            label="Llamar"
          />
          <ActionLink
            href={client?.phone ? whatsappUrl(client.phone) : ""}
            icon={MessageCircle}
            label="WhatsApp"
            external
          />
          <ActionButton
            icon={Navigation}
            label="Ir"
            onClick={() => setGoing(true)}
            disabled={!address}
          />
          <ActionButton
            icon={CheckCircle2}
            label="Terminé"
            onClick={() => setFinishing(true)}
            disabled={job.status === "cotizado"}
            strong
          />
        </div>
      ) : null}
      {going ? <GoSheet job={job} address={address} onClose={() => setGoing(false)} /> : null}
      {finishing ? <FinishSheet job={job} onClose={() => setFinishing(false)} /> : null}
    </Card>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
  external?: boolean;
}) {
  const cls =
    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold text-foreground";
  if (!href)
    return (
      <span className={cn(cls, "opacity-30")} aria-disabled>
        <Icon className="size-5" />
        {label}
      </span>
    );
  return (
    <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <Icon className="size-5" />
      {label}
    </a>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  strong,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold disabled:opacity-30",
        strong ? "text-success" : "text-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

/** "Ir": opens directions, starts the mileage and prepares "Voy en camino". */
export function GoSheet({
  job,
  address,
  onClose,
}: {
  job: Job;
  address: string;
  onClose: () => void;
}) {
  const { startTrip } = useMarcelo();
  const q = encodeURIComponent(address);
  const go = async (url: string) => {
    if (job.status === "confirmado") startTrip(job.id);
    void startTripFor(job.id);
    window.open(url, "_blank");
    onClose();
  };
  return (
    <Sheet
      title="Ir al trabajo"
      icon={<Navigation className="size-5 text-accent" />}
      onClose={onClose}
    >
      <p className="mb-4 text-[15px] text-muted-foreground">{address}</p>
      <div className="grid gap-2">
        <Button onClick={() => go(`https://www.google.com/maps/dir/?api=1&destination=${q}`)}>
          <Navigation className="size-5" /> Google Maps
        </Button>
        <Button variant="secondary" onClick={() => go(`https://waze.com/ul?q=${q}&navigate=yes`)}>
          <RouteIcon className="size-5" /> Waze
        </Button>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
        Marcelo prepara el aviso "Voy en camino" para tu cliente y empieza a contar las millas.
      </p>
    </Sheet>
  );
}

/** "Terminé": how much they paid and how, or "Aún no pagó". */
export function FinishSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  const { finishJob, addMiles, clientById, queueJobMessage } = useMarcelo();
  const [amount, setAmount] = useState(String(job.price));
  const [method, setMethod] = useState<PaymentMethod | "debe" | null>(null);
  const [miles, setMiles] = useState("");
  const [trip] = useState(() => hasTrip(job.id));
  const client = clientById(job.clientId);

  useEffect(() => {
    if (!trip) return;
    void endTripFor(job.id).then((m) => m !== null && setMiles(String(m)));
  }, [trip, job.id]);

  const value = Number(amount.replace(/[$,\s]/g, ""));
  const save = () => {
    if (!method || !(value > 0)) return;
    finishJob(job.id, value, method === "debe" ? null : method);
    const m = Number(miles);
    if (m > 0) addMiles({ jobId: job.id, date: todayISO(), miles: m, note: client?.name });
    toast.success(
      method === "debe"
        ? `Anotado en Por cobrar: ${money(value)}`
        : `Cobro registrado: ${money(value)}`,
      {
        action:
          method === "debe"
            ? { label: "Enviar factura", onClick: () => queueJobMessage("invoice", job.id) }
            : undefined,
      },
    );
    onClose();
  };

  return (
    <Sheet
      title="¿Cuánto te pagaron?"
      icon={<CheckCircle2 className="size-5 text-success" />}
      onClose={onClose}
    >
      <p className="mb-4 text-[15px] text-muted-foreground">
        {client?.name} · {job.service}
      </p>
      <Field
        label="Monto"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-14 text-[22px] font-bold"
      />
      <p className="mb-2 mt-5 text-[14px] font-medium text-muted-foreground">¿Cómo te pagó?</p>
      <Chips
        options={[
          ...paymentMethods.map((m) => {
            const Icon = methodIcon[m];
            return {
              key: m as PaymentMethod | "debe",
              label: paymentMethodLabel[m],
              icon: <Icon className="size-4" />,
            };
          }),
          { key: "debe" as const, label: "Aún no pagó", icon: <HandCoins className="size-4" /> },
        ]}
        value={method}
        onChange={setMethod}
      />
      <div className="mt-5">
        <Field
          label={trip ? "Millas de este viaje (puedes corregirlas)" : "Millas (opcional)"}
          inputMode="decimal"
          placeholder="0"
          value={miles}
          onChange={(e) => setMiles(e.target.value)}
        />
      </div>
      <Button className="mt-6 w-full" onClick={save} disabled={!method || !(value > 0)}>
        <CheckCircle2 className="size-5" /> Guardar
      </Button>
    </Sheet>
  );
}

/** "Cobré": a loose payment, optionally settling something in Por cobrar. */
export function PaymentSheet({
  onClose,
  clientId,
  receivableId,
}: {
  onClose: () => void;
  clientId?: string | undefined;
  receivableId?: string | undefined;
}) {
  const { state, recordPayment } = useMarcelo();
  const owed = state.receivables.find((r) => r.id === receivableId);
  const [who, setWho] = useState(clientId ?? owed?.clientId ?? "");
  const [amount, setAmount] = useState(owed ? String(owed.amount) : "");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [debt, setDebt] = useState(receivableId ?? "");
  const open = state.receivables.filter((r) => !r.paidAt && r.clientId === who);
  const value = Number(amount.replace(/[$,\s]/g, ""));

  return (
    <Sheet title="Cobré" icon={<Banknote className="size-5 text-success" />} onClose={onClose}>
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">Cliente</span>
        <select
          value={who}
          onChange={(e) => {
            setWho(e.target.value);
            setDebt("");
          }}
          className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px] outline-none focus:border-accent"
        >
          <option value="">Elige un cliente</option>
          {state.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {open.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[14px] font-medium text-muted-foreground">
            ¿Es de algo por cobrar?
          </p>
          <Chips
            options={[
              ...open.map((r) => ({
                key: r.id,
                label: `${money(r.amount)} · ${r.note ?? prettyDate(r.createdAt)}`,
              })),
              { key: "", label: "No, es otro pago" },
            ]}
            value={debt}
            onChange={(k) => {
              setDebt(k);
              const r = open.find((x) => x.id === k);
              if (r) setAmount(String(r.amount));
            }}
          />
        </div>
      ) : null}
      <div className="mt-4">
        <Field
          label="Monto"
          inputMode="decimal"
          value={amount}
          placeholder="$ 0"
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-[22px] font-bold"
        />
      </div>
      <p className="mb-2 mt-5 text-[14px] font-medium text-muted-foreground">¿Cómo te pagó?</p>
      <Chips
        options={paymentMethods.map((m) => {
          const Icon = methodIcon[m];
          return { key: m, label: paymentMethodLabel[m], icon: <Icon className="size-4" /> };
        })}
        value={method}
        onChange={setMethod}
      />
      <Button
        className="mt-6 w-full"
        disabled={!who || !method || !(value > 0)}
        onClick={() => {
          recordPayment({
            clientId: who,
            amount: value,
            method: method!,
            receivableId: debt || undefined,
          });
          toast.success(`Cobro registrado: ${money(value)}`);
          onClose();
        }}
      >
        <CheckCircle2 className="size-5" /> Guardar cobro
      </Button>
    </Sheet>
  );
}

export type JobDraft = {
  clientName: string;
  serviceId?: string | undefined;
  date: string;
  time: string;
  address?: string | undefined;
  price?: number | undefined;
  size?: Size | undefined;
};

/** Editable new job: one Confirmar, then Marcelo prepares the confirmation for the client. */
export function JobDraftCard({
  initial,
  onDone,
  onCancel,
}: {
  initial: JobDraft;
  onDone: (job: Job) => void;
  onCancel: () => void;
}) {
  const { state, findClientByName, addClient, addJob, updateClient, queueJobMessage } =
    useMarcelo();
  const known = findClientByName(initial.clientName);
  const byName = initial.serviceId ?? state.services.find((s) => s.name === known?.service)?.id;
  const [name, setName] = useState(known?.name ?? initial.clientName);
  const [serviceId, setServiceId] = useState(byName ?? state.services[0]?.id ?? "");
  const [size, setSize] = useState<Size | undefined>(initial.size);
  const service = state.services.find((s) => s.id === serviceId);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [address, setAddress] = useState(
    initial.address ?? (known ? [known.address, known.city].filter(Boolean).join(", ") : ""),
  );
  const [price, setPrice] = useState(
    String(initial.price ?? (service ? priceFor(service, size) : (known?.price ?? ""))),
  );
  const value = Number(price.replace(/[$,\s]/g, ""));

  const pickService = (id: string, sz = size) => {
    setServiceId(id);
    const s = state.services.find((x) => x.id === id);
    if (s) setPrice(String(priceFor(s, sz)));
  };

  const confirm = () => {
    const client =
      findClientByName(name) ??
      addClient({
        name: name.trim(),
        phone: "",
        address,
        city: state.profile.city,
        service: service?.name ?? "",
        price: value,
      });
    if (address && !client.address) updateClient(client.id, { address });
    const job = addJob({
      clientId: client.id,
      date,
      time,
      service: service?.name ?? "Trabajo",
      serviceId: service?.id,
      price: value,
      size,
      address: address || undefined,
      status: "confirmado",
    });
    if (client.phone) queueJobMessage("confirm", job.id);
    toast.success(`Trabajo con ${client.name} confirmado`);
    onDone(job);
  };

  return (
    <div className="space-y-3 text-left text-foreground">
      <div className="flex items-center gap-3">
        <ClientAvatar name={name || "?"} size="sm" />
        <Field
          label="Cliente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11"
        />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">Servicio</span>
        <select
          value={serviceId}
          onChange={(e) => pickService(e.target.value)}
          className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px] outline-none focus:border-accent"
        >
          {state.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {service?.sizes ? (
        <Chips
          options={(["chico", "mediano", "grande"] as const).map((k) => ({
            key: k,
            label: `${sizeLabel[k].es} ${money(service.sizes![k])}`,
          }))}
          value={size}
          onChange={(k) => {
            setSize(k);
            pickService(serviceId, k);
          }}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <Field
        label="Dirección"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="1244 Maple Ave, 91101"
      />
      <Field
        label="Precio"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={confirm} disabled={!name.trim() || !date || !time || !(value > 0)}>
          <CheckCircle2 className="size-5" /> Confirmar
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Clock className="size-4" /> Marcelo prepara la confirmación en inglés para tu cliente.
      </p>
    </div>
  );
}

/** "Nuevo trabajo" from anywhere. */
export function NewJobSheet({
  onClose,
  clientName = "",
  date,
}: {
  onClose: () => void;
  clientName?: string;
  date?: string;
}) {
  const navigate = useNavigate();
  return (
    <Sheet title="Nuevo trabajo" onClose={onClose}>
      <JobDraftCard
        initial={{
          clientName,
          date: date && date >= todayISO() ? date : todayISO(1),
          time: "09:00",
        }}
        onCancel={onClose}
        onDone={(job) => {
          onClose();
          navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } });
        }}
      />
    </Sheet>
  );
}
