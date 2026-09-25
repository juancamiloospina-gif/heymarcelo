export type Client = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  service: string;
  price: number;
  notes?: string;
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
  jobId?: string;
  amount: number;
  method: "efectivo" | "zelle" | "cheque" | "debe";
  date: string;
};

export type Expense = {
  id: string;
  category: "Gasolina" | "Herramientas" | "Materiales" | "Vehículo" | "Publicidad" | "Otros";
  amount: number;
  note?: string;
  date: string;
  receipt?: string;
};

export type Pending = {
  id: string;
  text: string;
  clientId?: string;
  amount?: number;
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

export type MarceloState = {
  profile: Profile;
  clients: Client[];
  jobs: Job[];
  payments: Payment[];
  expenses: Expense[];
  pendings: Pending[];
  messages: Message[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const todayISO = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const money = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const prettyTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

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
      { id: uid(), category: "Herramientas", amount: 85, date: todayISO(-4), note: "Tijeras nuevas" },
      { id: uid(), category: "Materiales", amount: 32, date: todayISO(-8), note: "Bolsas y guantes" },
    ],
    pendings: [
      { id: uid(), text: "John me debe $90", clientId: c1, amount: 90, done: false, createdAt: todayISO(-2) },
      { id: uid(), text: "Enviar factura a Robert", clientId: c3, done: false, createdAt: todayISO(-1) },
      { id: uid(), text: "Comprar fertilizante orgánico", done: false, createdAt: todayISO(-1) },
      { id: uid(), text: "Volver a casa de Sarah a limpiar hojas", clientId: c2, done: false, createdAt: todayISO() },
    ],
    messages: [],
  };
}
