export type Client = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  service: string;
  price: number;
  notes?: string | undefined;
};

/**
 * Lifecycle of a job: a quote (cotizado) becomes confirmed, the worker heads out (en_camino),
 * finishes (hecho) and gets paid (cobrado). Quotes expire (vencido); anything can be cancelled.
 */
export type JobStatus =
  | "consulta"
  | "cotizado"
  | "confirmado"
  | "en_camino"
  | "hecho"
  | "cobrado"
  | "vencido"
  | "cancelado";

export type Size = "chico" | "mediano" | "grande";

export type Job = {
  id: string;
  clientId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  service: string;
  serviceId?: string | undefined;
  price: number;
  status: JobStatus;
  size?: Size | undefined;
  /** Where the work happens; falls back to the client's address. */
  address?: string | undefined;
  /** Quotes expire 48 h after they're sent. */
  expiresAt?: string | undefined;
  conversationId?: string | undefined;
  /** Client messages already sent (or queued) for this job. */
  sent?:
    { confirm?: boolean; reminder?: boolean; onTheWay?: boolean; invoice?: boolean } | undefined;
  miles?: number | undefined;
};

export type PaymentMethod = "efectivo" | "zelle" | "cashapp" | "cheque" | "tarjeta";

export type Payment = {
  id: string;
  clientId: string;
  jobId?: string | undefined;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string | undefined;
};

/** Money a client still owes ("Por cobrar"). */
export type Receivable = {
  id: string;
  clientId: string;
  jobId?: string | undefined;
  amount: number;
  note?: string | undefined;
  createdAt: string;
  paidAt?: string | undefined;
};

export type ExpenseCategory =
  | "Gasolina"
  | "Herramientas"
  | "Materiales"
  | "Vehículo"
  | "Publicidad"
  | "Seguro"
  | "Teléfono"
  | "Ayudantes"
  | "Otros";

export type Expense = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note?: string | undefined;
  store?: string | undefined;
  date: string;
  receipt?: string | undefined;
};

/** A trip logged against a job (or on its own). Distance only; no deduction advice. */
export type MileLog = {
  id: string;
  jobId?: string | undefined;
  date: string;
  miles: number;
  note?: string | undefined;
};

/** "Recordatorio": something to remember, never money (that lives in Por cobrar). */
export type Pending = {
  id: string;
  text: string;
  clientId?: string | undefined;
  done: boolean;
  createdAt: string;
  due?: string | undefined;
};

export type Message = {
  id: string;
  clientId: string;
  es: string;
  en: string;
  date: string;
};

export type Profile = {
  name: string;
  trade: string;
  city: string;
  onboarded: boolean;
};

export type ServiceKind =
  "pasto" | "poda" | "limpieza" | "riego" | "plantas" | "reparacion" | "general";

export type Service = {
  id: string;
  name: string;
  /** How Marcelo names it to English-speaking clients. */
  nameEn: string;
  /** Flat price, or the "Mediano" price when the service is priced by size. */
  price: number;
  /** Optional price per job size. When present, Marcelo asks the size before quoting. */
  sizes?: Record<Size, number> | undefined;
  minutes: number;
  kind: ServiceKind;
};

export type Channel = "whatsapp" | "sms";

export type Connection = {
  connected: boolean;
  number?: string | undefined;
};

/** "tu_turno": Marcelo needs the user. "manual": the user took over, Marcelo stays quiet. */
export type ConversationStage =
  "nuevo" | "cotizado" | "agendado" | "rechazado" | "tu_turno" | "manual";

export type InboxMessage = {
  id: string;
  from: "client" | "marcelo" | "user";
  text: string;
  /** Spanish version shown to the user when `text` is in English. */
  es?: string | undefined;
  /** What Marcelo understood from a client message, in Spanish. */
  note?: string | undefined;
  /** Client sent a photo (demo: flagged by the simulator). */
  photo?: boolean | undefined;
  at: string; // ISO datetime
};

export type Conversation = {
  id: string;
  channel: Channel;
  contactName: string;
  phone: string;
  clientId?: string | undefined;
  lang: "en" | "es";
  stage: ConversationStage;
  serviceId?: string | undefined;
  /** Several services fit the request; Marcelo asked which one. */
  candidates?: string[] | undefined;
  /** Price the user explicitly chose for this client (discount or custom). */
  price?: number | undefined;
  size?: Size | undefined;
  address?: string | undefined;
  /** Day/hour the client asked for, kept while Marcelo asks for address or size. */
  prefer?: { day?: string | undefined; hour?: number | undefined } | undefined;
  /** What Marcelo asked for and is waiting on before it can quote. */
  awaiting?: "address" | "size" | "service" | undefined;
  proposal?: { date: string; time: string } | undefined;
  jobId?: string | undefined;
  /** When Marcelo handed the chat to the user, for the 15-minute bridge message. */
  handoffAt?: string | undefined;
  bridgeSent?: boolean | undefined;
  followupSent?: boolean | undefined;
  messages: InboxMessage[];
  unread: boolean;
  updatedAt: string;
};

export type DayHours = { on: boolean; start: string; end: string };

export type AutoMessageKind = "confirm" | "reminder" | "onTheWay";

export type Settings = {
  autoReply: boolean;
  /** Working hours per weekday, 0 = domingo. */
  hours: Record<number, DayHours>;
  /** Dates with no work (vacaciones, días libres). */
  blocked: string[];
  /** Minutes between jobs to drive. */
  bufferMin: number;
  /** "ask": show the message for one tap; "auto": send on its own. */
  autoMessages: Record<AutoMessageKind, "ask" | "auto">;
  /** Shown on invoices ("Zelle: (626) 555-0100"). */
  paymentInstructions: string;
  largeText: boolean;
};

/** A client message Marcelo prepared and is waiting for the user's tap to send. */
export type OutboxItem = {
  id: string;
  kind: AutoMessageKind | "invoice";
  jobId: string;
  conversationId: string;
  text: string;
  es: string;
  createdAt: string;
};

export type MarceloState = {
  version: 2;
  profile: Profile;
  clients: Client[];
  jobs: Job[];
  payments: Payment[];
  receivables: Receivable[];
  expenses: Expense[];
  miles: MileLog[];
  pendings: Pending[];
  messages: Message[];
  services: Service[];
  conversations: Conversation[];
  connections: Record<Channel, Connection>;
  settings: Settings;
  outbox: OutboxItem[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

// Local calendar date (not UTC), so "hoy" doesn't roll over early in the evening in the US.
export const todayISO = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return isoOf(d);
};

export const isoOf = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export const monthISO = () => todayISO().slice(0, 7);

export const expenseCategories: ExpenseCategory[] = [
  "Gasolina",
  "Herramientas",
  "Materiales",
  "Vehículo",
  "Publicidad",
  "Seguro",
  "Teléfono",
  "Ayudantes",
  "Otros",
];

export const paymentMethods: PaymentMethod[] = [
  "efectivo",
  "zelle",
  "cashapp",
  "cheque",
  "tarjeta",
];

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  zelle: "Zelle",
  cashapp: "Cash App",
  cheque: "Cheque",
  tarjeta: "Tarjeta",
};

export const sizeLabel: Record<Size, { es: string; en: string }> = {
  chico: { es: "Chico", en: "small" },
  mediano: { es: "Mediano", en: "medium" },
  grande: { es: "Grande", en: "large" },
};

export const statusLabel: Record<JobStatus, string> = {
  consulta: "Consulta",
  cotizado: "Cotizado",
  confirmado: "Confirmado",
  en_camino: "En camino",
  hecho: "Hecho",
  cobrado: "Cobrado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

/** Jobs that still take a spot in the calendar. */
export const isActiveJob = (j: Job) =>
  j.status === "cotizado" || j.status === "confirmado" || j.status === "en_camino";

export const priceFor = (s: Service, size?: Size) => (size && s.sizes ? s.sizes[size] : s.price);
export const priceRange = (s: Service) =>
  s.sizes
    ? ([Math.min(...Object.values(s.sizes)), Math.max(...Object.values(s.sizes))] as const)
    : null;

export const money = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const signedMoney = (n: number) => `${n < 0 ? "−" : ""}${money(n)}`;

export const prettyTime = (t: string) => {
  const [rawH, rawM] = t.split(":").map(Number);
  const h = rawH ?? 0;
  const m = rawM ?? 0;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const prettyDateEn = (iso: string) => {
  if (iso === todayISO()) return "today";
  if (iso === todayISO(1)) return "tomorrow";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

export const nowISO = () => new Date().toISOString();

export const digits = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/** Three-letter weekday names used everywhere (Lun, Mar, Mié…). */
export const dayShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

const monthShort = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export const prettyDate = (iso: string) => {
  if (!iso) return "Sin fecha";
  if (iso === todayISO()) return "Hoy";
  if (iso === todayISO(1)) return "Mañana";
  if (iso === todayISO(-1)) return "Ayer";
  const d = new Date(`${iso}T12:00:00`);
  return `${dayShort[d.getDay()]} ${d.getDate()} ${monthShort[d.getMonth()]}`;
};

export const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000,
  );

export const jobStart = (j: Pick<Job, "date" | "time">) => new Date(`${j.date}T${j.time}:00`);

export const zipOf = (address?: string) => address?.match(/\b\d{5}\b/)?.[0];

export const defaultHours = (): Record<number, DayHours> => ({
  0: { on: false, start: "08:00", end: "14:00" },
  1: { on: true, start: "08:00", end: "17:00" },
  2: { on: true, start: "08:00", end: "17:00" },
  3: { on: true, start: "08:00", end: "17:00" },
  4: { on: true, start: "08:00", end: "17:00" },
  5: { on: true, start: "08:00", end: "17:00" },
  6: { on: true, start: "08:00", end: "14:00" },
});

export const defaultSettings = (): Settings => ({
  autoReply: true,
  hours: defaultHours(),
  blocked: [],
  bufferMin: 30,
  autoMessages: { confirm: "ask", reminder: "ask", onTheWay: "ask" },
  paymentInstructions: "",
  largeText: false,
});

/**
 * Brings data saved by older versions of the app to the current shape, so nobody loses
 * their clients, jobs or money after an update.
 */
export function migrate(raw: unknown): MarceloState {
  const base = demoState();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Record<string, unknown> & Partial<MarceloState>;
  if (s.version === 2) {
    return { ...base, ...s, settings: { ...defaultSettings(), ...s.settings } } as MarceloState;
  }

  type OldJob = Omit<Job, "status"> & { status: string };
  type OldPayment = Omit<Payment, "method"> & { method: string };
  type OldPending = Pending & { amount?: number };
  type OldSettings = {
    autoReply?: boolean;
    workDays?: number[];
    workStart?: string;
    workEnd?: string;
  };

  const oldPayments = (s.payments as OldPayment[] | undefined) ?? base.payments;
  const paidJobs = new Set(
    oldPayments.filter((p) => p.jobId && p.method !== "debe").map((p) => p.jobId),
  );
  const jobs = ((s.jobs as OldJob[] | undefined) ?? base.jobs).map((j): Job => {
    const status: JobStatus =
      j.status === "por_confirmar"
        ? "cotizado"
        : j.status === "completado"
          ? paidJobs.has(j.id)
            ? "cobrado"
            : "hecho"
          : ((j.status as JobStatus) ?? "confirmado");
    return { ...j, status };
  });
  const payments = oldPayments
    .filter((p) => p.method !== "debe")
    .map((p): Payment => ({
      ...p,
      method: (paymentMethods as string[]).includes(p.method)
        ? (p.method as PaymentMethod)
        : "efectivo",
    }));

  const oldPendings = (s.pendings as OldPending[] | undefined) ?? [];
  const receivables: Receivable[] = oldPendings
    .filter((p) => typeof p.amount === "number" && p.clientId)
    .map((p) => ({
      id: p.id,
      clientId: p.clientId!,
      amount: p.amount!,
      note: p.text,
      createdAt: p.createdAt,
      paidAt: p.done ? p.createdAt : undefined,
    }));
  const pendings: Pending[] = oldPendings
    .filter((p) => typeof p.amount !== "number")
    .map(({ amount: _amount, ...p }) => p);

  const old = (s.settings as OldSettings | undefined) ?? {};
  const hours = defaultHours();
  if (old.workDays) {
    for (let d = 0; d < 7; d++) {
      hours[d] = {
        on: old.workDays.includes(d),
        start: old.workStart ?? hours[d]!.start,
        end: old.workEnd ?? hours[d]!.end,
      };
    }
  }

  return {
    ...base,
    ...(s as object),
    version: 2,
    jobs,
    payments,
    receivables: s.pendings ? receivables : base.receivables,
    pendings: s.pendings ? pendings : base.pendings,
    miles: [],
    outbox: [],
    settings: { ...defaultSettings(), autoReply: old.autoReply ?? true, hours },
  } as MarceloState;
}

export function demoState(): MarceloState {
  const base = demoBase();
  // Emily already got a quote from Marcelo: she's a prospect with a job waiting for her "yes".
  const emily = base.conversations.find((c) => c.id === "conv_emily")!;
  const client: Client = {
    id: "cli_emily",
    name: "Emily Johnson",
    phone: emily.phone,
    address: emily.address ?? "",
    city: "Pasadena, CA",
    service: "Poda y limpieza",
    price: 150,
  };
  const job: Job = {
    id: "job_emily",
    clientId: client.id,
    date: emily.proposal!.date,
    time: emily.proposal!.time,
    service: "Poda y limpieza",
    serviceId: "srv_poda",
    price: 150,
    size: "mediano",
    address: emily.address,
    status: "cotizado",
    expiresAt: new Date(Date.now() + 47 * 3_600_000).toISOString(),
    conversationId: emily.id,
  };
  emily.clientId = client.id;
  emily.jobId = job.id;
  return { ...base, clients: [...base.clients, client], jobs: [...base.jobs, job] };
}

function demoBase(): MarceloState {
  const c1 = "cli_john";
  const c2 = "cli_sarah";
  const c3 = "cli_robert";
  const c4 = "cli_michael";
  const job = (j: Omit<Job, "id">): Job => ({ id: uid(), ...j });
  return {
    version: 2,
    profile: { name: "", trade: "", city: "", onboarded: false },
    clients: [
      {
        id: c1,
        name: "John Smith",
        phone: "(626) 555-0142",
        address: "1244 Maple Ave, 91101",
        city: "Pasadena, CA",
        service: "Corte de pasto y limpieza",
        price: 120,
      },
      {
        id: c2,
        name: "Sarah Williams",
        phone: "(818) 555-0173",
        address: "742 Evergreen Terrace, 91203",
        city: "Glendale, CA",
        service: "Poda y limpieza",
        price: 150,
      },
      {
        id: c3,
        name: "Robert Miller",
        phone: "(818) 555-0119",
        address: "515 Olive Street, 91502",
        city: "Burbank, CA",
        service: "Mantenimiento general",
        price: 85,
      },
      {
        id: c4,
        name: "Michael Clark",
        phone: "(213) 555-0188",
        address: "3080 Sunset Blvd, 90026",
        city: "Los Ángeles, CA",
        service: "Limpieza de jardín",
        price: 95,
      },
    ],
    jobs: [
      job({
        clientId: c1,
        date: todayISO(),
        time: "09:00",
        service: "Corte de pasto y limpieza",
        serviceId: "srv_pasto",
        price: 120,
        status: "confirmado",
      }),
      job({
        clientId: c2,
        date: todayISO(),
        time: "11:00",
        service: "Poda y limpieza",
        serviceId: "srv_poda",
        price: 150,
        status: "confirmado",
      }),
      job({
        clientId: c3,
        date: todayISO(),
        time: "14:30",
        service: "Mantenimiento general",
        serviceId: "srv_mant",
        price: 85,
        status: "cotizado",
        expiresAt: new Date(Date.now() + 20 * 3_600_000).toISOString(),
      }),
      job({
        clientId: c4,
        date: todayISO(1),
        time: "10:00",
        service: "Limpieza de jardín",
        serviceId: "srv_jardin",
        price: 95,
        status: "confirmado",
      }),
      job({
        clientId: c2,
        date: todayISO(3),
        time: "08:30",
        service: "Poda y limpieza",
        serviceId: "srv_poda",
        price: 150,
        status: "confirmado",
      }),
    ],
    payments: [
      { id: uid(), clientId: c1, amount: 120, method: "efectivo", date: todayISO(-3) },
      { id: uid(), clientId: c2, amount: 150, method: "zelle", date: todayISO(-5) },
      { id: uid(), clientId: c3, amount: 85, method: "cheque", date: todayISO(-7) },
      { id: uid(), clientId: c4, amount: 95, method: "cashapp", date: todayISO(-9) },
      { id: uid(), clientId: c2, amount: 150, method: "zelle", date: todayISO(-12) },
      { id: uid(), clientId: c1, amount: 120, method: "efectivo", date: todayISO(-15) },
    ],
    receivables: [
      { id: uid(), clientId: c1, amount: 90, note: "Limpieza extra", createdAt: todayISO(-4) },
    ],
    expenses: [
      {
        id: uid(),
        category: "Gasolina",
        amount: 45,
        date: todayISO(-1),
        store: "Chevron",
        note: "Tanque lleno",
      },
      {
        id: uid(),
        category: "Herramientas",
        amount: 85,
        date: todayISO(-4),
        store: "Home Depot",
        note: "Tijeras nuevas",
      },
      {
        id: uid(),
        category: "Materiales",
        amount: 32,
        date: todayISO(-8),
        store: "Lowe's",
        note: "Bolsas y guantes",
      },
    ],
    miles: [],
    pendings: [
      {
        id: uid(),
        text: "Enviar factura a Robert",
        clientId: c3,
        done: false,
        createdAt: todayISO(-3),
        due: todayISO(-1),
      },
      { id: uid(), text: "Comprar fertilizante orgánico", done: false, createdAt: todayISO(-1) },
      {
        id: uid(),
        text: "Volver a casa de Sarah a limpiar hojas",
        clientId: c2,
        done: false,
        createdAt: todayISO(),
        due: todayISO(2),
      },
    ],
    messages: [],
    services: demoServices(),
    conversations: demoConversations(),
    connections: {
      whatsapp: { connected: true, number: "(626) 555-0100" },
      sms: { connected: false },
    },
    settings: defaultSettings(),
    outbox: [],
  };
}

function demoServices(): Service[] {
  return [
    {
      id: "srv_pasto",
      name: "Corte de pasto y limpieza",
      nameEn: "Lawn mowing & cleanup",
      price: 120,
      sizes: { chico: 90, mediano: 120, grande: 180 },
      minutes: 90,
      kind: "pasto",
    },
    {
      id: "srv_poda",
      name: "Poda y limpieza",
      nameEn: "Hedge & tree trimming",
      price: 150,
      sizes: { chico: 110, mediano: 150, grande: 220 },
      minutes: 120,
      kind: "poda",
    },
    {
      id: "srv_jardin",
      name: "Limpieza de jardín",
      nameEn: "Yard & leaf cleanup",
      price: 95,
      minutes: 90,
      kind: "limpieza",
    },
    {
      id: "srv_mant",
      name: "Mantenimiento general",
      nameEn: "General yard maintenance",
      price: 85,
      minutes: 60,
      kind: "general",
    },
    {
      id: "srv_riego",
      name: "Instalación de riego",
      nameEn: "Sprinkler installation",
      price: 250,
      minutes: 180,
      kind: "riego",
    },
  ];
}

function demoConversations(): Conversation[] {
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  // Next weekday at least two days out, so the demo quote is always in the future.
  let offset = 2;
  while (new Date(`${todayISO(offset)}T12:00:00`).getDay() === 0) offset += 1;
  const date = todayISO(offset);
  return [
    {
      id: "conv_emily",
      channel: "whatsapp",
      contactName: "Emily Johnson",
      phone: "(626) 555-0199",
      lang: "en",
      stage: "cotizado",
      serviceId: "srv_poda",
      size: "mediano",
      address: "88 Lake Ave, 91101",
      proposal: { date, time: "10:00" },
      unread: true,
      updatedAt: at(12),
      messages: [
        {
          id: uid(),
          from: "client",
          text: "Hi! Do you do hedge trimming? Medium-size yard at 88 Lake Ave, 91101 😅",
          note: "Pide: Poda y limpieza",
          at: at(14),
        },
        {
          id: uid(),
          from: "marcelo",
          text: `Hi Emily! Yes, hedge & tree trimming for a medium yard is $150. I can come ${prettyDateEn(date)} at 10:00 AM. Does that work for you? Reply YES to book it.`,
          es: `¡Hola Emily! Sí, la poda y limpieza para un jardín mediano cuesta $150. Puedo ir el ${prettyDate(date)} a las 10:00 AM. ¿Te sirve? Responde SÍ para agendar.`,
          at: at(12),
        },
      ],
    },
    {
      id: "conv_david",
      channel: "whatsapp",
      contactName: "David Lee",
      phone: "(818) 555-0147",
      lang: "en",
      stage: "tu_turno",
      serviceId: "srv_pasto",
      size: "mediano",
      handoffAt: at(95),
      bridgeSent: true,
      unread: true,
      updatedAt: at(95),
      messages: [
        {
          id: uid(),
          from: "client",
          text: "How much for mowing every week? Could you do $90?",
          note: "Pidió descuento",
          at: at(97),
        },
        {
          id: uid(),
          from: "marcelo",
          text: "Thanks David! My regular price for lawn mowing & cleanup is $120. Let me check with the owner about a weekly rate and I'll get back to you shortly.",
          es: "¡Gracias David! Mi precio normal por corte de pasto y limpieza es $120. Déjame consultar un precio semanal y te respondo pronto.",
          at: at(95),
        },
      ],
    },
  ];
}
