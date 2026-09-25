import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Mic, Send, X, Check, Pencil, Languages } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, Card } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyTime, todayISO } from "@/lib/marcelo-data";
import { askMarcelo } from "@/lib/marcelo.functions";

type MarceloAction = Record<string, any> & { type: string };

type AssistantCtx = { open: (seed?: string) => void };
const Ctx = createContext<AssistantCtx>({ open: () => {} });
export const useAssistant = () => useContext(Ctx);

function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-US";
    u.rate = 1;
    synth.speak(u);
  } catch {
    /* no speech synthesis */
  }
}

function Wave({ active }: { active: boolean }) {
  return (
    <div className="flex h-16 items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className={active ? "w-1.5 rounded-full bg-accent animate-wave" : "w-1.5 rounded-full bg-border"}
          style={{ height: 48, animationDelay: `${i * 0.11}s`, transform: active ? undefined : "scaleY(0.2)" }}
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
  const recognitionRef = useRef<any>(null);
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
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setListening(false);
    setIsOpen(false);
  }, []);

  const snapshot = useMemo(() => {
    const { clients, jobs, expenses, pendings, payments, profile } = store.state;
    const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "cliente";
    const month = new Date().toISOString().slice(0, 7);
    const income = payments
      .filter((p) => p.date.startsWith(month) && p.method !== "debe")
      .reduce((a, b) => a + b.amount, 0);
    const spent = expenses.filter((e) => e.date.startsWith(month)).reduce((a, b) => a + b.amount, 0);
    return [
      `Usuario: ${profile.name || "Carlos"} — ${profile.trade || "servicios"} en ${profile.city || "Los Ángeles, CA"}`,
      `Clientes: ${clients
        .map((c) => `${c.name} (${c.service}, ${money(c.price)} habitual, ${c.address}, ${c.city}, tel ${c.phone})`)
        .join("; ")}`,
      `Trabajos próximos: ${jobs
        .filter((j) => j.date >= todayISO())
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 12)
        .map((j) => `${j.date} ${prettyTime(j.time)} ${name(j.clientId)} — ${j.service} ${money(j.price)} (${j.status})`)
        .join("; ")}`,
      `Ingresos del mes: ${money(income)}. Gastos del mes: ${money(spent)}. Ganancia: ${money(income - spent)}.`,
      `Gastos recientes: ${expenses.slice(0, 6).map((e) => `${e.category} ${money(e.amount)} ${e.date}`).join("; ")}`,
      `Pendientes: ${pendings.filter((p) => !p.done).map((p) => p.text).join("; ")}`,
    ].join("\n");
  }, [store.state]);

  const runAction = useCallback(
    (action: MarceloAction) => {
      switch (action.type) {
        case "CREATE_JOB": {
          const client =
            store.findClientByName(String(action.clientName ?? "")) ??
            store.addClient({
              name: String(action.clientName ?? "Cliente nuevo"),
              phone: "",
              address: "",
              city: store.state.profile.city || "",
              service: String(action.service ?? "Servicio"),
              price: Number(action.price ?? 0),
            });
          const job = store.addJob({
            clientId: client.id,
            date: String(action.date ?? todayISO()),
            time: String(action.time ?? "09:00"),
            service: String(action.service ?? client.service),
            price: Number(action.price ?? client.price),
            status: "confirmado",
          });
          toast.success(`Cita agendada con ${client.name}`);
          close();
          navigate({ to: "/trabajo/$jobId", params: { jobId: job.id } });
          return;
        }
        case "CREATE_CLIENT": {
          const c = store.addClient({
            name: String(action.name ?? "Cliente nuevo"),
            phone: String(action.phone ?? ""),
            address: String(action.address ?? ""),
            city: String(action.city ?? store.state.profile.city ?? ""),
            service: String(action.service ?? ""),
            price: Number(action.price ?? 0),
          });
          toast.success(`${c.name} agregado a tus clientes`);
          close();
          navigate({ to: "/clientes/$clientId", params: { clientId: c.id } });
          return;
        }
        case "CREATE_EXPENSE": {
          store.addExpense({
            category: (action.category ?? "Otros") as any,
            amount: Number(action.amount ?? 0),
            note: action.note ? String(action.note) : undefined,
            date: todayISO(),
          });
          toast.success(`Gasto registrado: ${money(Number(action.amount ?? 0))}`);
          break;
        }
        case "RECORD_PAYMENT": {
          const client = store.findClientByName(String(action.clientName ?? ""));
          store.addPayment({
            clientId: client?.id ?? "",
            amount: Number(action.amount ?? 0),
            method: (action.method ?? "efectivo") as any,
            date: todayISO(),
          });
          toast.success(`Pago registrado: ${money(Number(action.amount ?? 0))}`);
          break;
        }
        case "CREATE_PENDING": {
          const client = action.clientName ? store.findClientByName(String(action.clientName)) : undefined;
          store.addPending(String(action.text ?? "Pendiente"), {
            clientId: client?.id,
            amount: action.amount ? Number(action.amount) : undefined,
          });
          toast.success("Pendiente agregado");
          break;
        }
        case "TRANSLATE_MESSAGE": {
          const client = store.findClientByName(String(action.clientName ?? ""));
          if (client) {
            store.addMessage({
              clientId: client.id,
              es: String(action.es ?? heard),
              en: String(action.en ?? ""),
              date: todayISO(),
            });
            close();
            navigate({ to: "/mensaje/$clientId", params: { clientId: client.id } });
            return;
          }
          toast.error("No encontré ese cliente");
          break;
        }
        default:
          break;
      }
      setPendingAction(null);
    },
    [store, close, navigate, heard],
  );

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;
      setHeard(value);
      setTyped("");
      setThinking(true);
      setReply("");
      setPendingAction(null);
      try {
        const res = await askMarcelo({ data: { text: value, today: todayISO(), snapshot } });
        setReply(res.reply);
        speak(res.reply);
        if (res.ok && res.action) {
          if (res.confirm) setPendingAction(res.action as MarceloAction);
          else runAction(res.action as MarceloAction);
        }
      } catch {
        setReply("No pude conectarme. Revisa tu internet e intenta otra vez.");
      } finally {
        setThinking(false);
      }
    },
    [snapshot, runAction],
  );

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.info("Tu navegador no permite dictado. Escribe lo que necesitas.");
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = "es-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        const transcript = Array.from(e.results)
          .map((r: any) => r[0].transcript)
          .join(" ");
        setHeard(transcript);
        if (e.results[e.results.length - 1].isFinal) {
          setListening(false);
          void send(transcript);
        }
      };
      rec.onerror = () => {
        setListening(false);
        toast.error("No te escuché bien. Intenta de nuevo.");
      };
      rec.onend = () => setListening(false);
      setHeard("");
      setReply("");
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
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
        <div className="fixed inset-0 z-50 flex justify-center bg-primary/35 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col bg-background">
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <span className="text-[15px] font-semibold tracking-tight">Marcelo</span>
              <button
                onClick={close}
                aria-label="Cerrar"
                className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <Wave active={listening || thinking} />
              <p className="text-center text-[15px] font-semibold text-foreground">
                {listening ? "Te escucho" : thinking ? "Un momento…" : reply ? "" : "Dime qué necesitas"}
              </p>
              {!heard && !reply ? (
                <p className="mx-auto mt-2 max-w-[280px] text-center text-[13px] leading-relaxed text-muted-foreground">
                  Habla normalmente en español. Yo me encargo del resto.
                </p>
              ) : null}

              {heard ? (
                <Card className="mt-5 bg-muted/60">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Dijiste</p>
                  <p className="mt-1 text-[15px] text-foreground">{heard}</p>
                </Card>
              ) : null}

              {reply ? (
                <Card className="mt-3 border-accent/30">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Marcelo</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-foreground">{reply}</p>
                  {pendingAction ? (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => runAction(pendingAction)}>
                        <Check className="size-4" /> Confirmar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setPendingAction(null)}>
                        <Pencil className="size-4" /> Cambiar
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ) : null}

              {!heard && !reply ? (
                <div className="mt-6 space-y-2">
                  {[
                    "Mañana tengo que ir donde John a las nueve",
                    "Registra 45 dólares de gasolina",
                    "Dile a Sarah que voy a llegar veinte minutos tarde",
                    "¿Cuánto hice este mes?",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-[14px] text-muted-foreground"
                    >
                      <Languages className="size-4 shrink-0 text-accent" />
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="border-t border-border bg-card px-5 pb-6 pt-4">
              <div className="flex items-center justify-center">
                <button
                  onClick={listening ? () => recognitionRef.current?.stop() : startListening}
                  aria-label={listening ? "Detener" : "Hablar con Marcelo"}
                  className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  {listening ? (
                    <span className="absolute inset-0 rounded-full bg-accent/50 animate-pulse-ring" />
                  ) : null}
                  <Mic className="relative size-6" />
                </button>
              </div>
              <form
                className="mt-4 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(typed);
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="O escríbeme aquí"
                  className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-[15px] outline-none focus:border-accent"
                />
                <Button size="sm" type="submit" aria-label="Enviar" disabled={!typed.trim() || thinking}>
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
