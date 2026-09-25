import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Mic, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Screen } from "@/components/marcelo/kit";
import { useAssistant } from "@/components/marcelo/assistant";
import { useMarcelo } from "@/lib/marcelo-store";
import { askMarcelo } from "@/lib/marcelo.functions";
import { todayISO } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mensaje/$clientId")({
  head: () => ({
    meta: [
      { title: "Comunicación con clientes — Marcelo" },
      {
        name: "description",
        content:
          "Dile a Marcelo qué quieres decir en español y él lo escribe en inglés profesional.",
      },
      { property: "og:title", content: "Comunicación con clientes — Marcelo" },
      {
        property: "og:description",
        content: "Tú hablas español, tu cliente lee inglés. Marcelo traduce por ti.",
      },
    ],
  }),
  component: Mensaje,
});

function Mensaje() {
  const { clientId } = useParams({ from: "/mensaje/$clientId" });
  const { state, clientById, addMessage } = useMarcelo();
  const { open } = useAssistant();
  const navigate = useNavigate();
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const client = clientById(clientId);
  const history = state.messages.filter((m) => m.clientId === clientId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, en]);

  if (!client) {
    return (
      <Screen>
        <p className="text-[15px] text-muted-foreground">No encontré ese cliente.</p>
      </Screen>
    );
  }

  const translate = async () => {
    if (!es.trim()) return;
    setLoading(true);
    try {
      const res = await askMarcelo({
        data: {
          text: `Dile a ${client.name}: ${es}`,
          today: todayISO(),
          snapshot: `Cliente: ${client.name} (${client.service}, ${client.city}).`,
        },
      });
      if (!res.ok) {
        toast.error(res.reply);
        return;
      }
      if (res.action?.type === "TRANSLATE_MESSAGE" && res.action.en) {
        setEn(String(res.action.en));
      } else {
        setEn(res.reply);
      }
    } catch {
      toast.error("No pude preparar el mensaje. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/clientes/$clientId", params: { clientId } })}
            className="p-1"
          >
            <ArrowLeft className="size-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-primary-foreground">
              {client.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <h1 className="text-[17px] font-bold leading-tight">{client.name}</h1>
              <p className="text-[12px] text-muted-foreground">{client.city || client.phone}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {client.phone ? (
            <a
              href={`tel:${client.phone}`}
              aria-label={`Llamar a ${client.name}`}
              className="rounded-full p-2 hover:bg-muted"
            >
              <Phone className="size-5" />
            </a>
          ) : null}
          <button
            aria-label="Ver cliente"
            onClick={() => navigate({ to: "/clientes/$clientId", params: { clientId } })}
            className="rounded-full p-2 hover:bg-muted"
          >
            <UserRound className="size-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="text-center">
          <span className="text-[12px] font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-wider">
            Hoy
          </span>
        </div>

        {history.map((m) => (
          <div key={m.id} className="space-y-4">
            <div className="flex justify-end">
              <div className="relative max-w-[85%] rounded-2xl rounded-tr-none bg-success/10 p-4 text-foreground shadow-sm">
                <p className="text-[15px] leading-relaxed">{m.es}</p>
                <p className="text-[12px] text-muted-foreground mt-2">Tu mensaje (español)</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="relative max-w-[85%] rounded-2xl rounded-tl-none border border-accent/15 bg-accent/10 p-4 text-foreground shadow-sm">
                <p className="text-[15px] leading-relaxed">{m.en}</p>
                <p className="mt-2 text-[12px] text-accent">Mensaje para el cliente (inglés)</p>
              </div>
            </div>
          </div>
        ))}

        {en && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-success/10 p-4 text-foreground shadow-sm">
                <p className="text-[15px] leading-relaxed">{es}</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-none border border-accent bg-card p-4 shadow-md">
                <p className="text-[15px] leading-relaxed">{en}</p>
                <div className="mt-4 flex gap-2">
                  <Button
                    className="flex-1 h-10 text-[14px]"
                    onClick={() => {
                      addMessage({ clientId, es, en, date: todayISO() });
                      window.location.href = `sms:${client.phone}?&body=${encodeURIComponent(en)}`;
                      toast.success("Mensaje listo para enviar");
                      setEs("");
                      setEn("");
                    }}
                  >
                    <Send className="size-4" /> Enviar
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-10 text-[14px]"
                    onClick={() => setEn("")}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-card border-t pb-8">
        <div className="flex items-center gap-2">
          <button
            className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95"
            onClick={() => open(`Dile a ${client.name} que `)}
          >
            <Mic className="size-5" />
          </button>
          <div className="flex-1 relative">
            <input
              value={es}
              onChange={(e) => setEs(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && es.trim()) translate();
              }}
              placeholder="Habla o escribe en español..."
              className="w-full h-12 bg-muted/50 rounded-2xl px-4 pr-12 text-[15px] outline-none focus:ring-1 focus:ring-accent/30 transition-all"
            />
            <button
              className={cn(
                "absolute right-2 top-2 size-8 rounded-xl flex items-center justify-center transition-colors",
                es.trim() ? "text-accent bg-accent/10" : "text-muted-foreground/30",
              )}
              disabled={!es.trim() || loading}
              onClick={translate}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
