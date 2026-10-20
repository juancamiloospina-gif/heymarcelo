import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Globe,
  Home,
  Languages,
  MessagesSquare,
  Mic,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMarcelo } from "@/lib/marcelo-store";
import { useScrollLock } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";
import wave from "@/assets/marcelo-character-wave.png";
import character from "@/assets/marcelo-character.png";

type Step = {
  /** Screen shown behind the card, so the explanation matches what the user sees. */
  to?: "/" | "/agenda" | "/bandeja" | "/dinero" | "/configuracion";
  icon?: LucideIcon;
  title: string;
  body: string;
  points?: string[];
};

/** First-run tutorial: one short card per part of the app, for someone who has never seen it. */
const STEPS: Step[] = [
  {
    to: "/",
    title: "¡Bienvenido a Marcelo!",
    body: "Marcelo es tu asistente de trabajo: te ayuda con tus clientes, tu agenda y tu dinero, y habla con tus clientes en inglés por ti. Te muestro cada parte en menos de un minuto.",
  },
  {
    to: "/",
    icon: Home,
    title: "Inicio: tu día de un vistazo",
    body: "Aquí empieza todo.",
    points: [
      "Los 4 botones de arriba: Nuevo trabajo, Cobré, Anotar gasto y Traducir.",
      "“Necesitan tu atención”: clientes esperando, mensajes por enviar y cobros pendientes.",
      "“Hoy” y “Recordatorios”: lo que tienes que hacer.",
    ],
  },
  {
    to: "/agenda",
    icon: CalendarDays,
    title: "Agenda: tus trabajos por día",
    body: "Toca un día para ver sus trabajos.",
    points: [
      "El botón azul de arriba crea un trabajo nuevo.",
      "Cada trabajo tiene Llamar, WhatsApp, Ir (te lleva con el mapa) y Terminé (para cobrar).",
      "El reloj de arriba abre tus servicios ya realizados.",
    ],
  },
  {
    to: "/",
    icon: Mic,
    title: "El micrófono: háblale a Marcelo",
    body: "El botón redondo del centro es tu asistente de voz.",
    points: [
      "Tócalo y di, por ejemplo: “agenda a María mañana a las 10”.",
      "Mantenlo pulsado para abrir el traductor en vivo con tu cliente.",
      "Marcelo siempre te pide confirmar antes de cambiar algo.",
    ],
  },
  {
    to: "/bandeja",
    icon: MessagesSquare,
    title: "Mensajes: Marcelo atiende a tus clientes",
    body: "Cuando un cliente te escribe, Marcelo le contesta en inglés con tus precios y agenda el trabajo si acepta.",
    points: [
      "Lo que necesita tu decisión sale arriba, en “Necesitan tu atención”.",
      "“Respuesta automática” enciende o apaga a Marcelo.",
      "Tú ves todo en español.",
    ],
  },
  {
    to: "/dinero",
    icon: Wallet,
    title: "Dinero: cobros, gastos e impuestos",
    body: "Cuatro pestañas arriba:",
    points: [
      "Resumen: lo que ganaste este mes.",
      "Por cobrar: quién te debe, con recordatorio por mensaje.",
      "Gastos: anótalos con una foto del recibo o con tu voz.",
      "Contador: un paquete listo para tu contador a fin de año.",
    ],
  },
  {
    icon: Languages,
    title: "Traducir con tu cliente",
    body: "Desde Inicio (botón Traducir) o con el micrófono pulsado.",
    points: [
      "Tú hablas en español y Marcelo lo dice en inglés en voz alta.",
      "Pulsa “Pasar al cliente”: la pantalla cambia y él responde en inglés.",
      "No hay que escribir: las letras son grandes para leer al instante.",
    ],
  },
  {
    to: "/configuracion",
    icon: Globe,
    title: "Configuración: haz que te encuentren",
    body: "Aquí cuidas tu negocio.",
    points: [
      "Mi página: tu foto, tu historia, tus servicios y tu zona, para tus clientes.",
      "Tu QR y tu volante para la camioneta.",
      "Tu perfil, cómo te pagan, mensajes automáticos y tu propia IA.",
    ],
  },
  {
    to: "/",
    title: "¡Listo para empezar!",
    body: "Puedes volver a ver este tutorial cuando quieras, en Configuración. Empieza creando tu primer trabajo con el botón “Nuevo trabajo”.",
  },
];

export function Tour() {
  const { state, setProfile, ready } = useMarcelo();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const show = ready && state.profile.onboarded && !state.profile.tourDone;
  useScrollLock(show);

  const step = STEPS[i] ?? STEPS[0]!;
  const last = i === STEPS.length - 1;

  // The screen behind the card follows the step.
  useEffect(() => {
    if (show && step.to) navigate({ to: step.to });
  }, [show, step.to, navigate]);

  if (!show) return null;

  const finish = () => {
    setProfile({ tourDone: true });
    setI(0);
    navigate({ to: "/" });
  };
  const Icon = step.icon;
  const first = state.profile.name.split(" ")[0];

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 z-[70] flex justify-center">
      <div className="absolute inset-0 bg-black/55" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial de Marcelo"
        className="relative flex w-full max-w-md flex-col justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
      >
        <div className="max-h-full overflow-y-auto overscroll-contain rounded-[1.75rem] bg-card p-5 shadow-[var(--shadow-lift)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {i + 1} de {STEPS.length}
            </span>
            {!last ? (
              <button
                onClick={finish}
                className="h-10 px-2 text-[15px] font-semibold text-muted-foreground"
              >
                Saltar tutorial
              </button>
            ) : null}
          </div>

          <div className="flex items-start gap-3">
            {i === 0 || last ? (
              <img
                src={i === 0 ? wave : character}
                alt=""
                aria-hidden
                className="size-20 shrink-0 object-contain"
              />
            ) : Icon ? (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sky">
                <Icon className="size-7" strokeWidth={1.7} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">
                {i === 0 && first ? `¡Hola, ${first}! Bienvenido a Marcelo` : step.title}
              </h2>
              <p className="mt-1.5 text-[16px] leading-snug text-muted-foreground">{step.body}</p>
            </div>
          </div>

          {step.points ? (
            <ul className="mt-3 space-y-2">
              {step.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-[15px] leading-snug">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  {p}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
            {STEPS.map((_, n) => (
              <span
                key={n}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  n === i ? "w-6 bg-accent" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            {i > 0 ? (
              <button
                onClick={() => setI(i - 1)}
                aria-label="Atrás"
                className="flex size-14 items-center justify-center rounded-full border border-border bg-card"
              >
                <ArrowLeft className="size-5" />
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={() => (last ? finish() : setI(i + 1))}
              className={cn(
                "flex h-14 items-center justify-center gap-2 rounded-full bg-accent text-[17px] font-bold text-accent-foreground shadow-[var(--shadow-card)] active:scale-[0.98]",
                i === 0 && "col-span-2",
              )}
            >
              {last ? "Empezar" : i === 0 ? "Ver el recorrido" : "Siguiente"}
              {!last ? <ArrowRight className="size-5" /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
