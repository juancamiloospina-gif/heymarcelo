import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Mic, Send, X, Check, Pencil, Languages } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, Card } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyTime, todayISO } from "@/lib/marcelo-data";
import { askMarcelo } from "@/lib/marcelo.functions";

type MarceloAction = {
  type: string;
  clientName?: string;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  service?: string;
  price?: number | string;
  date?: string;
  time?: string;
  category?: string;
  amount?: number | string;
  note?: string;
  method?: string;
  text?: string;
  es?: string;
  en?: string;
};

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
    <div className="flex h-12 items-center justify-center gap-1.5">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className={active ? "w-1.5 rounded-full bg-accent/80 animate-wave" : "w-1.5 rounded-full bg-white/20"}
          style={{ height: 32, animationDelay: `${i * 0.11}s`, transform: active ? undefined : "scaleY(0.2)" }}
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
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A1629] text-white">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
          </div>

          <div className="relative flex items-center justify-between px-5 py-4">
            <button
              onClick={close}
              aria-label="Cerrar"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="size-5" />
            </button>
            <span className="text-[17px] font-semibold">Marcelo</span>
            <div className="w-10" />
          </div>

          <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-8 flex size-24 items-center justify-center rounded-[32px] bg-accent/20 ring-1 ring-accent/30 shadow-[0_0_40px_rgba(var(--accent-rgb),0.2)]">
              <img src="/lovable-uploads/marcelo-logo.png" alt="Marcelo" className="size-16 object-contain" onError={(e) => {
                // Fallback to a simple icon if logo is not found
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) parent.innerHTML = '<div class="text-4xl">🧹</div>';
              }} />
            </div>

            <h2 className="text-[28px] font-bold tracking-tight">
              {listening ? "Escuchando..." : thinking ? "Un momento…" : "Habla con Marcelo"}
            </h2>
            <p className="mt-3 max-w-[280px] text-[16px] leading-relaxed text-white/60">
              {listening ? "Te escucho..." : thinking ? "Estoy pensando..." : reply ? "" : "Di lo que necesitas en español. Él se encarga del resto."}
            </p>

            <div className="mt-12 w-full max-w-sm">
              <Wave active={listening || thinking} />
            </div>

            {reply ? (
              <div className="mt-8 w-full max-w-sm">
                <div className="rounded-3xl bg-white/5 border border-white/10 p-6 text-left shadow-xl backdrop-blur-sm">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-accent mb-2">Marcelo</p>
                  <p className="text-[17px] leading-relaxed text-white">{reply}</p>
                  {pendingAction ? (
                    <div className="mt-6 flex gap-3">
                      <Button className="flex-1 bg-accent text-white border-none" onClick={() => runAction(pendingAction)}>
                        <Check className="size-4" /> Confirmar
                      </Button>
                      <Button variant="secondary" className="flex-1 bg-white/10 border-none text-white" onClick={() => setPendingAction(null)}>
                        <Pencil className="size-4" /> Cambiar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {heard && !reply ? (
              <div className="mt-6 text-[18px] font-medium text-white/80 animate-in fade-in slide-in-from-bottom-2">
                "{heard}"
              </div>
            ) : null}
          </div>

          <div className="relative p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <button
                onClick={listening ? () => recognitionRef.current?.stop() : startListening}
                aria-label={listening ? "Detener" : "Hablar con Marcelo"}
                className="relative flex size-20 items-center justify-center rounded-full bg-accent text-white shadow-[0_0_30px_rgba(var(--accent-rgb),0.5)] transition-transform active:scale-95"
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
                  className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 pl-5 pr-12 text-[16px] text-white outline-none placeholder:text-white/30 focus:border-accent/50 focus:bg-white/10 transition-all"
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
