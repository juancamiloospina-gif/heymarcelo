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
  MoreHorizontal,
  Navigation,
  StickyNote,
  UserPlus,
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
import { surveyReasonText, useSurveyRequest } from "@/lib/survey";
import { cn } from "@/lib/utils";

export const statusTone: Record<JobStatus, "neutral" | "success" | "warning" | "danger"> = {
  consulta: "neutral",
  cotizado: "warning",
  confirmado: "neutral",
  en_camino: "warning",
  hecho: "danger",
  facturado: "warning",
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
  otro: MoreHorizontal,
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
          {job.notes ? (
            <p className="mt-1 flex items-start gap-1.5 text-[14px] text-muted-foreground">
              <StickyNote className="mt-0.5 size-4 shrink-0" />
              <span className="line-clamp-2">{job.notes}</span>
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
  const requestSurvey = useSurveyRequest();
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
    // Finished: ask the client to rate the service (a link by WhatsApp; see `useSurveyRequest`).
    void requestSurvey(job.id).then((r) => {
      // Without a phone there is nobody to ask; any other reason the user should know about.
      if (!r.ok && r.reason !== "no_phone") toast(surveyReasonText[r.reason]);
    });
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
  jobId,
  amount: presetAmount,
}: {
  onClose: () => void;
  clientId?: string | undefined;
  receivableId?: string | undefined;
  /** The job this payment closes ("Cobrado"), when opened from the job's screen. */
  jobId?: string | undefined;
  amount?: number | undefined;
}) {
  const { state, recordPayment } = useMarcelo();
  const owed = state.receivables.find((r) => r.id === receivableId);
  const [who, setWho] = useState(clientId ?? owed?.clientId ?? "");
  const [amount, setAmount] = useState(
    owed ? String(owed.amount) : presetAmount ? String(presetAmount) : "",
  );
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
            jobId,
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
  /** An existing client to start with (e.g. coming back from "Crear cliente"). */
  clientId?: string | undefined;
  serviceId?: string | undefined;
  date: string;
  time: string;
  address?: string | undefined;
  price?: number | undefined;
  size?: Size | undefined;
  notes?: string | undefined;
};

const DRAFT_KEY = "marcelo.jobDraft";
type SavedDraft = {
  serviceId: string;
  size?: Size | undefined;
  date: string;
  time: string;
  price: string;
  address: string;
  notes: string;
  from: "/" | "/agenda";
};

const NEW = "new";

function readDraft(): SavedDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SavedDraft) : null;
  } catch {
    return null;
  }
}

const clientAddress = (c: Client) => [c.address, c.city].filter(Boolean).join(", ");

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
  const { state, findClientByName, clientById, addClient, addJob, updateClient, queueJobMessage } =
    useMarcelo();
  const navigate = useNavigate();
  // Coming back from "Crear cliente": restore what was typed before leaving.
  const [saved] = useState(() => (initial.clientId ? readDraft() : null));
  // Read once (the initializer can run twice in development), forget after mounting.
  useEffect(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clean.
    }
  }, []);
  const known = initial.clientId
    ? clientById(initial.clientId)
    : initial.clientName
      ? findClientByName(initial.clientName)
      : undefined;
  const byName =
    saved?.serviceId ??
    initial.serviceId ??
    state.services.find((s) => s.name === known?.service)?.id;
  // "" = nobody picked yet, NEW = a client that does not exist yet, else the client's id.
  const [clientId, setClientId] = useState(known?.id ?? (initial.clientName.trim() ? NEW : ""));
  const [name, setName] = useState(known?.name ?? initial.clientName);
  const [serviceId, setServiceId] = useState(byName ?? state.services[0]?.id ?? "");
  const [size, setSize] = useState<Size | undefined>(saved?.size ?? initial.size);
  const service = state.services.find((s) => s.id === serviceId);
  const [date, setDate] = useState(saved?.date ?? initial.date);
  const [time, setTime] = useState(saved?.time ?? initial.time);
  const [address, setAddress] = useState(
    saved?.address || (initial.address ?? (known ? clientAddress(known) : "")),
  );
  const [price, setPrice] = useState(
    saved?.price ??
      String(initial.price ?? (service ? priceFor(service, size) : (known?.price ?? ""))),
  );
  const [notes, setNotes] = useState(saved?.notes ?? initial.notes ?? "");
  const [filled, setFilled] = useState(false);
  const [autoPrice, setAutoPrice] = useState(false);
  const value = Number(price.replace(/[$,\s]/g, ""));

  const pickService = (id: string, sz = size) => {
    setServiceId(id);
    const s = state.services.find((x) => x.id === id);
    if (s) setPrice(String(priceFor(s, sz)));
  };

  // Choosing an existing client fills in what the app already knows: address, usual service, price.
  const pickClient = (id: string) => {
    setClientId(id);
    // What came from the previous client's card does not follow the next one.
    if (filled) setAddress("");
    if (autoPrice && service) setPrice(String(priceFor(service, size)));
    setFilled(false);
    setAutoPrice(false);
    const c = id && id !== NEW ? clientById(id) : undefined;
    if (!c) {
      if (id === NEW) setName("");
      return;
    }
    setName(c.name);
    const addr = clientAddress(c);
    if (addr) {
      setAddress(addr);
      setFilled(true);
    }
    const usual = state.services.find((s) => s.name === c.service);
    if (usual) {
      setServiceId(usual.id);
      setPrice(String(c.price || priceFor(usual, size)));
      setAutoPrice(true);
    } else if (c.price) {
      setPrice(String(c.price));
      setAutoPrice(true);
    }
  };

  const createClientFirst = () => {
    try {
      const draft: SavedDraft = {
        serviceId,
        size,
        date,
        time,
        price,
        address,
        notes,
        from: window.location.pathname.startsWith("/agenda") ? "/agenda" : "/",
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      navigate({
        to: "/clientes",
        search: { nuevo: 1, ...(name.trim() ? { nombre: name.trim() } : {}), volver: draft.from },
      });
      onCancel();
    } catch {
      toast.error("No pude abrir Clientes. Intenta de nuevo.");
    }
  };

  const confirm = () => {
    const existing = clientId && clientId !== NEW ? clientById(clientId) : findClientByName(name);
    const client =
      existing ??
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
      notes: notes.trim() || undefined,
      status: "confirmado",
    });
    if (client.phone) queueJobMessage("confirm", job.id);
    toast.success(`Trabajo con ${client.name} confirmado`);
    onDone(job);
  };

  return (
    <div className="space-y-3 text-left text-foreground">
      <div className="flex items-start gap-3">
        <ClientAvatar name={name || "?"} size="sm" className="mt-8" />
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
            Cliente
          </span>
          <select
            value={clientId}
            onChange={(e) => pickClient(e.target.value)}
            className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px] outline-none focus:border-accent"
          >
            <option value="">Elige un cliente</option>
            {[...state.clients]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value={NEW}>＋ Cliente nuevo</option>
          </select>
        </label>
      </div>
      {clientId === NEW ? (
        <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
          <Field
            label="Nombre del cliente nuevo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11"
          />
          <Button variant="secondary" size="sm" className="w-full" onClick={createClientFirst}>
            <UserPlus className="size-4" /> Crear cliente con teléfono y dirección
          </Button>
          <p className="text-[13px] text-muted-foreground">
            Al guardar el cliente, vuelves aquí con lo que ya escribiste. Si solo pones el nombre,
            se guarda sin teléfono.
          </p>
        </div>
      ) : null}
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
      <div>
        <Field
          label="Dirección"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setFilled(false);
          }}
          placeholder="1244 Maple Ave, 91101"
        />
        {filled ? (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-success">
            <CheckCircle2 className="size-3.5" /> Dirección del cliente. Puedes cambiarla para este
            trabajo.
          </p>
        ) : null}
      </div>
      <Field
        label="Precio"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">
          Observaciones (opcional)
        </span>
        <textarea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Llevar sopladora y bolsas extra. Portón azul."
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-[16px] outline-none placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>
      <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={confirm}
          disabled={!clientId || !name.trim() || !date || !time || !(value > 0)}
        >
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
  clientId,
  date,
}: {
  onClose: () => void;
  clientName?: string;
  clientId?: string | undefined;
  date?: string;
}) {
  const navigate = useNavigate();
  return (
    <Sheet title="Nuevo trabajo" onClose={onClose}>
      <JobDraftCard
        initial={{
          clientName,
          clientId,
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
