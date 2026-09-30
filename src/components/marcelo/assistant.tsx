import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mic, Send, X, Check, Pencil, Languages } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, Card } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { isActiveJob, money, monthISO, prettyTime, todayISO } from "@/lib/marcelo-data";
import { ask } from "@/lib/ai/ask";
import { needsConfirmation, type MarceloAction } from "@/lib/ai/actions";
import { useAIStatus } from "@/lib/ai/config";
import mark from "@/assets/marcelo-mark.png";
import { JobDraftCard } from "./jobs";
import {
  dictate,
  speak,
  stopSpeaking,
  unlockSpeech,
  type SpeechRecognitionLike,
} from "@/lib/speech";

/** "Traduce", "modo intérprete", "translate"… opens the face-to-face interpreter instead. */
const EXAMPLES = ["Agenda a Robert el jueves a las 9", "Cóbrale a John", "Anota gasto 45 gasolina"];

const WANTS_INTERPRETER = /\b(traduc\w*|traductor|int[eé]rprete|translate|translator)\b/i;

type AssistantCtx = { open: (seed?: string) => void };
const Ctx = createContext<AssistantCtx>({ open: () => {} });
export const useAssistant = () => useContext(Ctx);

function Wave({ active }: { active: boolean }) {
  return (
    <div className="flex h-12 items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className={
            active
              ? "w-1.5 rounded-full bg-accent/80 animate-wave"
              : "w-1.5 rounded-full bg-white/20"
          }
          style={{
            height: 32,
            animationDelay: `${i * 0.11}s`,
            transform: active ? undefined : "scaleY(0.2)",
          }}
        />
      ))}
    </div>
  );
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState("");
  const [pendingAction, setPendingAction] = useState<MarceloAction | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const navigate = useNavigate();
  const store = useMarcelo();

  const open = useCallback((seed?: string) => {
    setIsOpen(true);
    setHeard(seed ?? "");
    setReply("");
    setPendingAction(null);
    setTyped("");
  }, []);

  const close = useCallback(() => {
    try {
      recognitionRef.current?.stop();
      stopSpeaking();
    } catch {
      /* ignore */
    }
    setListening(false);
    setIsOpen(false);
  }, []);

  const snapshot = useMemo(() => {
    const { clients, jobs, expenses, pendings, payments, profile } = store.state;
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "cliente";
    const month = monthISO();
    const income = payments
      .filter((p) => p.date.startsWith(month))
      .reduce((a, b) => a + b.amount, 0);
    const spent = expenses
      .filter((e) => e.date.startsWith(month))
      .reduce((a, b) => a + b.amount, 0);
    return [
      `Usuario: ${profile.name || "sin nombre"} — ${profile.trade || "servicios"} en ${profile.city || "ciudad sin indicar"}`,
      `Clientes: ${clients
        .map(
          (c) =>
            `${c.name} (${c.service}, ${money(c.price)} habitual, ${c.address}, ${c.city}, tel ${c.phone})`,
        )
        .join("; ")}`,
      `Trabajos próximos: ${jobs
        .filter((j) => j.date >= todayISO())
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 12)
        .map(
          (j) =>
            `${j.date} ${prettyTime(j.time)} ${name(j.clientId)} — ${j.service} ${money(j.price)} (${j.status})`,
        )
        .join("; ")}`,
      `Ingresos del mes: ${money(income)}. Gastos del mes: ${money(spent)}. Ganancia: ${money(income - spent)}.`,
      `Servicios y precios: ${store.state.services.map((sv) => `${sv.name} ${money(sv.price)} (${sv.minutes} min)`).join("; ")}`,
      `Gastos recientes: ${expenses
        .slice(0, 6)
        .map((e) => `${e.category} ${money(e.amount)} ${e.date}`)
        .join("; ")}`,
      `Por cobrar: ${
        store.state.receivables
          .filter((r) => !r.paidAt)
          .map((r) => `${name(r.clientId)} ${money(r.amount)}`)
          .join("; ") || "nada"
      }`,
      `Recordatorios: ${pendings
        .filter((p) => !p.done)
        .map((p) => p.text)
        .join("; ")}`,
    ].join("\n");
  }, [store.state]);

  const ai = useAIStatus();

  /** Applies one validated action to the user's own data. Nothing else is reachable from here. */
  const runAction = useCallback(
    (action: MarceloAction) => {
      const done = (msg: string) => {
        toast.success(msg);
        setPendingAction(null);
      };
      const notFound = (who: string) => {
        toast.error(`No encontré a ${who} en tus clientes`);
        setPendingAction(null);
      };
      const nextJobOf = (clientId: string, date?: string) =>
        store.state.jobs
          .filter((j) => j.clientId === clientId && isActiveJob(j) && j.date >= todayISO())
          .filter((j) => !date || j.date === date)
          .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))[0];

      switch (action.type) {
        case "CREATE_JOB": {
          const client =
            store.findClientByName(action.clientName) ??
            store.addClient({
              name: action.clientName,
              phone: "",
              address: "",
              city: store.state.profile.city || "",
              service: action.service ?? "Servicio",
              price: action.price ?? 0,
            });
          const job = store.addJob({
            clientId: client.id,
            date: action.date,
            time: action.time,
            service: action.service ?? client.service,
            price: action.price ?? client.price,
            status: "confirmado",
          });
          done(`Trabajo agendado con ${client.name}`);
          close();
          navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } });
          return;
        }
        case "RESCHEDULE_JOB": {
          const client = store.findClientByName(action.clientName);
          if (!client) return notFound(action.clientName);
          const job = nextJobOf(client.id, action.fromDate);
          if (!job) {
            toast.error(`${client.name} no tiene trabajos próximos`);
            return setPendingAction(null);
          }
          store.updateJob(job.id, { date: action.date, time: action.time });
          return done(`Trabajo de ${client.name} movido`);
        }
        case "CANCEL_JOB": {
          const client = store.findClientByName(action.clientName);
          if (!client) return notFound(action.clientName);
          const job = nextJobOf(client.id, action.date);
          if (!job) {
            toast.error(`${client.name} no tiene trabajos próximos`);
            return setPendingAction(null);
          }
          store.removeJob(job.id);
          return done(`Trabajo de ${client.name} cancelado`);
        }
        case "CREATE_CLIENT": {
          const c = store.addClient({
            name: action.name,
            phone: action.phone ?? "",
            address: action.address ?? "",
            city: action.city ?? store.state.profile.city ?? "",
            service: action.service ?? "",
            price: action.price ?? 0,
          });
          done(`${c.name} agregado a tus clientes`);
          close();
          navigate({ to: "/clientes/$clientId", params: { clientId: c.id } });
          return;
        }
        case "UPDATE_CLIENT": {
          const client = store.findClientByName(action.clientName);
          if (!client) return notFound(action.clientName);
          const { phone, address, city, notes } = action;
          store.updateClient(client.id, {
            ...(phone ? { phone } : {}),
            ...(address ? { address } : {}),
            ...(city ? { city } : {}),
            ...(notes ? { notes } : {}),
          });
          return done(`Datos de ${client.name} actualizados`);
        }
        case "CREATE_EXPENSE":
          store.addExpense({
            category: action.category,
            amount: action.amount,
            note: action.note,
            date: todayISO(),
          });
          return done(`Gasto registrado: ${money(action.amount)}`);
        case "RECORD_PAYMENT": {
          const client = store.findClientByName(action.clientName);
          if (!client) return notFound(action.clientName);
          store.recordPayment({
            clientId: client.id,
            amount: action.amount,
            method: action.method,
          });
          return done(`Pago registrado: ${money(action.amount)}`);
        }
        case "CREATE_PENDING": {
          const client = action.clientName ? store.findClientByName(action.clientName) : undefined;
          // Money owed goes to Por cobrar; everything else is a Recordatorio.
          if (client && action.amount) {
            store.addReceivable({ clientId: client.id, amount: action.amount, note: action.text });
            return done(`Anotado en Por cobrar: ${money(action.amount)}`);
          }
          store.addPending(action.text, { clientId: client?.id });
          return done("Recordatorio agregado");
        }
        case "COMPLETE_PENDING": {
          const needle = action.text.toLowerCase();
          const p = store.state.pendings.find(
            (x) => !x.done && x.text.toLowerCase().includes(needle),
          );
          if (!p) {
            toast.error("No encontré ese pendiente");
            return setPendingAction(null);
          }
          store.togglePending(p.id);
          return done("Pendiente marcado como listo");
        }
        case "UPDATE_SERVICE_PRICE": {
          const needle = action.serviceName.toLowerCase();
          const svc = store.state.services.find(
            (x) => x.name.toLowerCase().includes(needle) || needle.includes(x.name.toLowerCase()),
          );
          if (!svc) {
            toast.error("No encontré ese servicio en tus precios");
            return setPendingAction(null);
          }
          store.updateService(svc.id, { price: action.price });
          return done(`${svc.name} ahora cuesta ${money(action.price)}`);
        }
        case "TRANSLATE_MESSAGE": {
          const client = store.findClientByName(action.clientName);
          if (!client) return notFound(action.clientName);
          store.addMessage({
            clientId: client.id,
            es: action.es || heard,
            en: action.en,
            date: todayISO(),
          });
          close();
          navigate({ to: "/mensaje/$clientId", params: { clientId: client.id } });
          return;
        }
      }
    },
    [store, close, navigate, heard],
  );

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;
      // "Dile a John que…" stays a message draft; a bare "traduce" opens the interpreter.
      if (WANTS_INTERPRETER.test(value) && !/\bdile\b/i.test(value)) {
        close();
        navigate({ to: "/traducir" });
        return;
      }
      setHeard(value);
      setTyped("");
      setThinking(true);
      setReply("");
      setPendingAction(null);
      try {
        const res = await ask({ text: value, today: todayISO(), snapshot });
        setLimitHit(!res.ok && res.reason === "limit");
        setReply(res.reply);
        speak(res.reply);
        if (res.ok && res.action) {
          // Every change to the user's data waits for an explicit tap, whatever the model says.
          if (needsConfirmation(res.action)) setPendingAction(res.action);
          else runAction(res.action);
        }
      } catch {
        setReply("No pude conectarme. Revisa tu internet e intenta otra vez.");
      } finally {
        setThinking(false);
      }
    },
    [snapshot, runAction, close, navigate],
  );

  const startListening = useCallback(() => {
    stopSpeaking();
    unlockSpeech();
    setHeard("");
    setReply("");
    const rec = dictate("es", {
      onText: setHeard,
      onFinal: (t) => {
        setListening(false);
        void send(t);
      },
      onError: () => {
        setListening(false);
        toast.error("No te escuché bien. Intenta de nuevo.");
      },
      onEnd: () => setListening(false),
    });
    if (!rec) {
      toast.info("Tu navegador no permite dictado. Escribe lo que necesitas.");
      return;
    }
    recognitionRef.current = rec;
    setListening(true);
  }, [send]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-primary text-primary-foreground">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
          </div>

          <div className="relative flex items-center justify-between px-5 py-4">
            <button
              onClick={close}
              aria-label="Cerrar"
              className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20"
            >
              <X className="size-5" />
            </button>
            <span className="text-[17px] font-semibold">Marcelo</span>
            <button
              onClick={() => {
                close();
                navigate({ to: "/configuracion" });
              }}
              className="rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground/80"
            >
              {ai.own ? "Sin límite" : `Quedan ${ai.left}`}
            </button>
          </div>

          <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-8 flex size-24 items-center justify-center rounded-[2rem] bg-card p-3 shadow-[var(--shadow-lift)]">
              <img src={mark} alt="Marcelo" className="size-full object-contain" />
            </div>

            <h2 className="text-[28px] font-bold tracking-tight">
              {listening ? "Escuchando..." : thinking ? "Un momento…" : "Habla con Marcelo"}
            </h2>
            <p className="mt-3 max-w-[280px] text-[16px] leading-relaxed text-primary-foreground/60">
              {listening
                ? "Te escucho..."
                : thinking
                  ? "Estoy pensando..."
                  : reply
                    ? ""
                    : "Di lo que necesitas en español. Él se encarga del resto."}
            </p>

            {!reply && !listening && !thinking ? (
              <button
                onClick={() => {
                  close();
                  navigate({ to: "/traducir" });
                }}
                className="mt-6 flex items-center gap-2 rounded-full bg-sky px-5 py-3 text-[15px] font-semibold text-white shadow-[var(--shadow-lift)]"
              >
                <Languages className="size-5" /> Traducir con mi cliente
              </button>
            ) : null}

            <div className="mt-10 w-full max-w-sm">
              {listening || thinking ? (
                <Wave active />
              ) : !reply && !heard ? (
                <div className="flex flex-col items-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => void send(ex)}
                      className="min-h-12 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-4 text-[15px] text-primary-foreground/85"
                    >
                      “{ex}”
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {reply ? (
              <div className="mt-8 w-full max-w-sm">
                <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 text-left shadow-xl backdrop-blur-sm">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-accent mb-2">
                    Marcelo
                  </p>
                  <p className="text-[17px] leading-relaxed text-primary-foreground">{reply}</p>
                  {limitHit ? (
                    <Button
                      className="mt-5 w-full border-none bg-accent text-accent-foreground"
                      onClick={() => {
                        close();
                        navigate({ to: "/configuracion" });
                      }}
                    >
                      Ver opciones
                    </Button>
                  ) : null}
                  {pendingAction?.type === "CREATE_JOB" ? (
                    <div className="mt-5 rounded-2xl bg-card p-4">
                      <JobDraftCard
                        initial={{
                          clientName: pendingAction.clientName,
                          serviceId: store.state.services.find(
                            (sv) => sv.name === pendingAction.service,
                          )?.id,
                          date: pendingAction.date,
                          time: pendingAction.time,
                          price: pendingAction.price,
                        }}
                        onCancel={() => setPendingAction(null)}
                        onDone={(job) => {
                          setPendingAction(null);
                          close();
                          navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } });
                        }}
                      />
                    </div>
                  ) : pendingAction ? (
                    <div className="mt-6 flex gap-3">
                      <Button
                        className="flex-1 border-none bg-accent text-accent-foreground"
                        onClick={() => runAction(pendingAction)}
                      >
                        <Check className="size-4" /> Confirmar
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1 border-none bg-primary-foreground/10 text-primary-foreground"
                        onClick={() => setPendingAction(null)}
                      >
                        <Pencil className="size-4" /> Cambiar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {heard && !reply ? (
              <div className="mt-6 text-[18px] font-medium text-primary-foreground/80 animate-in fade-in slide-in-from-bottom-2">
                "{heard}"
              </div>
            ) : null}
          </div>

          <div className="relative p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <button
                onClick={listening ? () => recognitionRef.current?.stop() : startListening}
                aria-label={listening ? "Detener" : "Hablar con Marcelo"}
                className="relative flex size-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-lift)] transition-transform active:scale-95"
              >
                {listening ? (
                  <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
                ) : null}
                <Mic className="relative size-8" />
              </button>
            </div>

            <div className="w-full max-w-sm">
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(typed);
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Habla o escribe en español..."
                  className="h-14 w-full rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 pl-5 pr-12 text-[16px] text-primary-foreground outline-none placeholder:text-primary-foreground/30 focus:border-accent/50 focus:bg-primary-foreground/10 transition-all"
                />
                <button
                  type="submit"
                  disabled={!typed.trim() || thinking}
                  className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-xl text-accent hover:bg-accent/10 disabled:opacity-30 transition-colors"
                >
                  <Send className="size-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
