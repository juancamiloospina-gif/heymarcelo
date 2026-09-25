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

export type JobStatus = "confirmado" | "por_confirmar" | "completado";

export type Job = {
  id: string;
  clientId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  service: string;
  price: number;
  status: JobStatus;
};

export type Payment = {
  id: string;
  clientId: string;
  jobId?: string | undefined;
  amount: number;
  method: "efectivo" | "zelle" | "cheque" | "debe";
  date: string;
};

export type Expense = {
  id: string;
  category: "Gasolina" | "Herramientas" | "Materiales" | "Vehículo" | "Publicidad" | "Otros";
  amount: number;
  note?: string | undefined;
  date: string;
  receipt?: string | undefined;
};

export type Pending = {
  id: string;
  text: string;
  clientId?: string | undefined;
  amount?: number | undefined;
  done: boolean;
  createdAt: string;
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
  price: number;
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
  /** Price agreed for this client when it differs from the service's list price. */
  price?: number | undefined;
  proposal?: { date: string; time: string } | undefined;
  jobId?: string | undefined;
  messages: InboxMessage[];
  unread: boolean;
  updatedAt: string;
};

export type Settings = {
  autoReply: boolean;
  workDays: number[]; // 0 = domingo
  workStart: string; // HH:mm
  workEnd: string; // HH:mm
};

export type MarceloState = {
  profile: Profile;
  clients: Client[];
  jobs: Job[];
  payments: Payment[];
  expenses: Expense[];
  pendings: Pending[];
  messages: Message[];
  services: Service[];
  conversations: Conversation[];
  connections: Record<Channel, Connection>;
  settings: Settings;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

// Local calendar date (not UTC), so "hoy" doesn't roll over early in the evening in the US.
export const todayISO = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export const monthISO = () => todayISO().slice(0, 7);

export const expenseCategories: Expense["category"][] = [
  "Gasolina",
  "Herramientas",
  "Materiales",
  "Vehículo",
  "Publicidad",
  "Otros",
];

export const paymentMethodLabel: Record<Payment["method"], string> = {
  efectivo: "Efectivo",
  zelle: "Zelle",
  cheque: "Cheque",
  debe: "Pendiente",
};

export const money = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

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

export const prettyDate = (iso: string) => {
  if (iso === todayISO()) return "Hoy";
  if (iso === todayISO(1)) return "Mañana";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-US", { weekday: "long", day: "numeric", month: "long" });
};

export function demoState(): MarceloState {
  const c1 = "cli_john";
  const c2 = "cli_sarah";
  const c3 = "cli_robert";
  const c4 = "cli_michael";
  return {
    profile: { name: "", trade: "", city: "", onboarded: false },
    clients: [
      {
        id: c1,
        name: "John Smith",
        phone: "(626) 555-0142",
        address: "1244 Maple Ave",
        city: "Pasadena, CA",
        service: "Corte de pasto y limpieza",
        price: 120,
      },
      {
        id: c2,
        name: "Sarah Williams",
        phone: "(818) 555-0173",
        address: "742 Evergreen Terrace",
        city: "Glendale, CA",
        service: "Poda y limpieza",
        price: 150,
      },
      {
        id: c3,
        name: "Robert Miller",
        phone: "(818) 555-0119",
        address: "515 Olive Street",
        city: "Burbank, CA",
        service: "Mantenimiento general",
        price: 85,
      },
      {
        id: c4,
        name: "Michael Clark",
        phone: "(213) 555-0188",
        address: "3080 Sunset Blvd",
        city: "Los Ángeles, CA",
        service: "Limpieza de jardín",
        price: 95,
      },
    ],
    jobs: [
      {
        id: uid(),
        clientId: c1,
        date: todayISO(),
        time: "09:00",
        service: "Corte de pasto y limpieza",
        price: 120,
        status: "confirmado",
      },
      {
        id: uid(),
        clientId: c2,
        date: todayISO(),
        time: "11:00",
        service: "Poda y limpieza",
        price: 150,
        status: "confirmado",
      },
      {
        id: uid(),
        clientId: c3,
        date: todayISO(),
        time: "14:30",
        service: "Mantenimiento general",
        price: 85,
        status: "por_confirmar",
      },
      {
        id: uid(),
        clientId: c4,
        date: todayISO(1),
        time: "10:00",
        service: "Limpieza de jardín",
        price: 95,
        status: "confirmado",
      },
      {
        id: uid(),
        clientId: c2,
        date: todayISO(3),
        time: "08:30",
        service: "Poda y limpieza",
        price: 150,
        status: "confirmado",
      },
    ],
    payments: [
      { id: uid(), clientId: c1, amount: 120, method: "efectivo", date: todayISO(-3) },
      { id: uid(), clientId: c2, amount: 150, method: "zelle", date: todayISO(-5) },
      { id: uid(), clientId: c3, amount: 85, method: "cheque", date: todayISO(-7) },
      { id: uid(), clientId: c4, amount: 95, method: "efectivo", date: todayISO(-9) },
      { id: uid(), clientId: c2, amount: 150, method: "zelle", date: todayISO(-12) },
      { id: uid(), clientId: c1, amount: 120, method: "efectivo", date: todayISO(-15) },
    ],
    expenses: [
      { id: uid(), category: "Gasolina", amount: 45, date: todayISO(-1), note: "Tanque lleno" },
      {
        id: uid(),
        category: "Herramientas",
        amount: 85,
        date: todayISO(-4),
        note: "Tijeras nuevas",
      },
      {
        id: uid(),
        category: "Materiales",
        amount: 32,
        date: todayISO(-8),
        note: "Bolsas y guantes",
      },
    ],
    pendings: [
      {
        id: uid(),
        text: "John me debe $90",
        clientId: c1,
        amount: 90,
        done: false,
        createdAt: todayISO(-2),
      },
      {
        id: uid(),
        text: "Enviar factura a Robert",
        clientId: c3,
        done: false,
        createdAt: todayISO(-1),
      },
      { id: uid(), text: "Comprar fertilizante orgánico", done: false, createdAt: todayISO(-1) },
      {
        id: uid(),
        text: "Volver a casa de Sarah a limpiar hojas",
        clientId: c2,
        done: false,
        createdAt: todayISO(),
      },
    ],
    messages: [],
    services: demoServices(),
    conversations: demoConversations(),
    connections: {
      whatsapp: { connected: true, number: "(626) 555-0100" },
      sms: { connected: false },
    },
    settings: {
      autoReply: true,
      workDays: [1, 2, 3, 4, 5, 6],
      workStart: "08:00",
      workEnd: "17:00",
    },
  };
}

function demoServices(): Service[] {
  return [
    {
      id: "srv_pasto",
      name: "Corte de pasto y limpieza",
      nameEn: "Lawn mowing & cleanup",
      price: 120,
      minutes: 90,
      kind: "pasto",
    },
    {
      id: "srv_poda",
      name: "Poda y limpieza",
      nameEn: "Hedge & tree trimming",
      price: 150,
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
      proposal: { date, time: "10:00" },
      unread: true,
      updatedAt: at(12),
      messages: [
        {
          id: uid(),
          from: "client",
          text: "Hi! Do you do hedge trimming? My bushes are getting out of control 😅",
          note: "Pide: Poda y limpieza",
          at: at(14),
        },
        {
          id: uid(),
          from: "marcelo",
          text: `Hi Emily! Yes, hedge & tree trimming is $150. I can come ${prettyDateEn(date)} at 10:00 AM. Does that work for you? Reply YES to book it.`,
          es: `¡Hola Emily! Sí, la poda y limpieza cuesta $150. Puedo ir el ${prettyDate(date)} a las 10:00 AM. ¿Te sirve? Responde SÍ para agendar.`,
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
