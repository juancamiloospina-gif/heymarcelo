/**
 * "Marcelo te recomienda": short, actionable tips computed from the user's own data.
 * Every tip must point at something real in the state and link to where it's fixed.
 */
import {
  CalendarClock,
  CalendarPlus,
  Camera,
  MessageCircle,
  TrendingUp,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/marcelo/visual";
import { findSlot } from "./marcelo-autopilot";
import {
  isActiveJob,
  money,
  monthISO,
  prettyTime,
  todayISO,
  type MarceloState,
} from "./marcelo-data";

export type Insight = {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  body: string;
  cta: { label: string; to: string; params?: Record<string, string> };
};

const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000,
  );

export function getInsights(state: MarceloState): Insight[] {
  const out: Insight[] = [];
  const today = todayISO();
  const name = (id?: string) =>
    state.clients.find((c) => c.id === id)?.name.split(" ")[0] ?? "Un cliente";

  // 3. Jobs coming up that the client hasn't confirmed.
  const unconfirmed = state.jobs
    .filter((j) => j.status === "cotizado" && j.date >= today && daysBetween(today, j.date) <= 2)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (unconfirmed) {
    out.push({
      id: "unconfirmed",
      icon: UserRoundCheck,
      tone: "teal",
      title: `${name(unconfirmed.clientId)} no ha confirmado`,
      body: `El trabajo de ${unconfirmed.date === today ? "hoy" : "mañana"} a las ${prettyTime(unconfirmed.time)} sigue cotizado.`,
      cta: { label: "Ver trabajo", to: "/trabajo/$jobId", params: { jobId: unconfirmed.id } },
    });
  }

  // 4. Free time tomorrow that could be filled.
  const tomorrow = todayISO(1);
  const tomorrowJobs = state.jobs.filter((j) => j.date === tomorrow && isActiveJob(j)).length;
  const worksTomorrow =
    state.settings.hours[new Date(`${tomorrow}T12:00:00`).getDay()]?.on ?? false;
  const freeTomorrow = worksTomorrow ? findSlot(state, 120, { day: tomorrow }) : undefined;
  if (freeTomorrow && tomorrowJobs <= 1) {
    out.push({
      id: "free-slot",
      icon: CalendarPlus,
      tone: "success",
      title: "Mañana tienes espacio libre",
      body: `Desde las ${prettyTime(freeTomorrow.time)}. Ofrécelo a un cliente habitual y llena el día.`,
      cta: { label: "Ver clientes", to: "/clientes" },
    });
  }

  // 5. Regular clients who haven't been visited in a while.
  const lastVisit = new Map<string, string>();
  for (const j of state.jobs) {
    if (j.date <= today && (lastVisit.get(j.clientId) ?? "") < j.date)
      lastVisit.set(j.clientId, j.date);
  }
  for (const p of state.payments) {
    if ((lastVisit.get(p.clientId) ?? "") < p.date) lastVisit.set(p.clientId, p.date);
  }
  const hasUpcoming = new Set(state.jobs.filter((j) => j.date >= today).map((j) => j.clientId));
  const dormant = [...lastVisit.entries()]
    .filter(([id, d]) => !hasUpcoming.has(id) && daysBetween(d, today) >= 14)
    .sort((a, b) => a[1].localeCompare(b[1]))[0];
  if (dormant) {
    out.push({
      id: "dormant",
      icon: CalendarClock,
      tone: "plum",
      title: `Hace ${Math.floor(daysBetween(dormant[1], today) / 7)} semanas que no vas donde ${name(dormant[0])}`,
      body: "Un mensaje corto ofreciendo un trabajo suele traer trabajo de vuelta.",
      cta: { label: "Escribirle", to: "/mensaje/$clientId", params: { clientId: dormant[0] } },
    });
  }

  // 6. Expenses without receipts this month (the accountant will ask for them).
  const noReceipt = state.expenses.filter((e) => e.date.startsWith(monthISO()) && !e.receipt);
  if (noReceipt.length >= 2) {
    out.push({
      id: "receipts",
      icon: Camera,
      tone: "sky",
      title: `${noReceipt.length} gastos sin foto del recibo`,
      body: `Suman ${money(noReceipt.reduce((a, b) => a + b.amount, 0))}. Con foto es más fácil deducirlos en impuestos.`,
      cta: { label: "Ver gastos", to: "/dinero" },
    });
  }

  // 7. Services priced well below the user's average ticket.
  const avg = state.services.reduce((a, s) => a + s.price, 0) / Math.max(1, state.services.length);
  const cheap = state.services
    .filter((s) => s.price < avg * 0.6 && s.minutes >= 60)
    .sort((a, b) => a.price / a.minutes - b.price / b.minutes)[0];
  if (cheap) {
    const perHour = Math.round((cheap.price / cheap.minutes) * 60);
    out.push({
      id: "pricing",
      icon: TrendingUp,
      tone: "accent",
      title: `Revisa el precio de ${cheap.name.toLowerCase()}`,
      body: `Te deja ${money(perHour)} por hora, bastante menos que tus otros servicios.`,
      cta: { label: "Ver precios", to: "/servicios" },
    });
  }

  // 8. Nudge to turn on auto-replies.
  const anyConnected = state.connections.whatsapp.connected || state.connections.sms.connected;
  if (!anyConnected || !state.settings.autoReply) {
    out.push({
      id: "connect",
      icon: MessageCircle,
      tone: "success",
      title: anyConnected ? "Deja que Marcelo conteste por ti" : "Conecta WhatsApp o SMS",
      body: "Marcelo responde a tus clientes con tus precios y agenda el trabajo cuando aceptan.",
      cta: {
        label: anyConnected ? "Activar" : "Conectar",
        to: anyConnected ? "/bandeja" : "/conexiones",
      },
    });
  }

  return out;
}
