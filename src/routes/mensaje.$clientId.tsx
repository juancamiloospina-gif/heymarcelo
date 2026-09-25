import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Send, Mic } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useAssistant } from "@/components/marcelo/assistant";
import { useMarcelo } from "@/lib/marcelo-store";
import { askMarcelo } from "@/lib/marcelo.functions";
import { todayISO } from "@/lib/marcelo-data";

export const Route = createFileRoute("/mensaje/$clientId")({
  head: () => ({
    meta: [
      { title: "Mensaje al cliente — Marcelo" },
      {
        name: "description",
        content: "Dile a Marcelo qué quieres decir en español y él lo escribe en inglés profesional.",
      },
      { property: "og:title", content: "Mensaje al cliente — Marcelo" },
      { property: "og:description", content: "Tú hablas español, tu cliente lee inglés. Marcelo traduce por ti." },
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

  const client = clientById(clientId);
  const history = state.messages.filter((m) => m.clientId === clientId);

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
      const action = (res as any).action;
      if (action?.type === "TRANSLATE_MESSAGE" && action.en) setEn(String(action.en));
      else setEn(res.reply);
    } catch {
      toast.error("No pude preparar el mensaje. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <button
        onClick={() => navigate({ to: "/clientes/$clientId", params: { clientId } })}
        className="mb-4 flex items-center gap-1.5 text-[14px] text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> {client.name}
      </button>

      <h1 className="text-[24px] font-semibold leading-tight">{client.name}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">{client.city}</p>

      <SectionTitle>Lo que quieres decir</SectionTitle>
      <Card className="space-y-3">
        <textarea
          value={es}
          onChange={(e) => setEs(e.target.value)}
          rows={3}
          placeholder="Escríbelo en español, como se lo dirías a un amigo."
          className="w-full resize-none rounded-xl border border-input bg-background p-3 text-[15px] outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void translate()} disabled={!es.trim() || loading}>
            {loading ? "Preparando…" : "Preparar mensaje"}
          </Button>
          <Button variant="secondary" aria-label="Dictar" onClick={() => open(`Dile a ${client.name} que `)}>
            <Mic className="size-4" />
          </Button>
        </div>
      </Card>

      {en ? (
        <>
          <SectionTitle>Mensaje en inglés para {client.name.split(" ")[0]}</SectionTitle>
          <Card>
            <p className="text-[15px] leading-relaxed">{en}</p>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
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
              <Button variant="secondary" onClick={() => setEn("")}>
                Editar
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <SectionTitle>Mensajes anteriores</SectionTitle>
          <div className="space-y-3">
            {history.map((m) => (
              <Card key={m.id}>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Tú dijiste</p>
                <p className="mt-0.5 text-[14px]">{m.es}</p>
                <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-accent">En inglés</p>
                <p className="mt-0.5 text-[14px]">{m.en}</p>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </Screen>
  );
}
