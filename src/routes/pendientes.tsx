import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus, ChevronRight, MessageSquare, House, FileText, AlertCircle } from "lucide-react";
import { Button, Card, Empty, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pendientes")({
  head: () => ({
    meta: [
      { title: "Pendientes — Marcelo" },
      { name: "description", content: "Lo que no se te puede olvidar: cobros, visitas de regreso y recados." },
      { property: "og:title", content: "Pendientes — Marcelo" },
      { property: "og:description", content: "Cobros, visitas de regreso y recados en una sola lista." },
    ],
  }),
  component: Pendientes,
});

function Pendientes() {
  const { state, togglePending, addPending } = useMarcelo();
  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");

  const tabs = ["Todos", "Quejas", "Solicitudes", "Otros"];

  const open = state.pendings.filter((p) => !p.done);
  const done = state.pendings.filter((p) => p.done);

  const getIcon = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes("cobrar") || t.includes("dinero") || t.includes("pago")) return { icon: AlertCircle, color: "bg-destructive/10 text-destructive" };
    if (t.includes("volver") || t.includes("casa") || t.includes("visita")) return { icon: House, color: "bg-accent/10 text-accent" };
    if (t.includes("factura") || t.includes("enviar")) return { icon: FileText, color: "bg-warning/15 text-warning-foreground" };
    return { icon: MessageSquare, color: "bg-muted text-muted-foreground" };
  };

  return (
    <Screen>
      <div className="flex items-center justify-between mb-2">
         <button onClick={() => window.history.back()} className="text-muted-foreground">
           <ChevronRight className="size-6 rotate-180" />
         </button>
      </div>
      
      <PageTitle title="Pendientes" />

      <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors",
               activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card className="flex items-center gap-2 p-2 mb-6 shadow-sm border-none bg-muted/50">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              addPending(text.trim());
              setText("");
            }
          }}
          placeholder="Agregar un pendiente"
          className="h-11 flex-1 rounded-lg bg-transparent px-3 text-[15px] outline-none"
        />
        <Button
          size="sm"
          aria-label="Agregar"
          className="rounded-xl"
          disabled={!text.trim()}
          onClick={() => {
            addPending(text.trim());
            setText("");
          }}
        >
          <Plus className="size-5" />
        </Button>
      </Card>

      {open.length === 0 ? (
        <Empty title="Todo al día." hint="No tienes nada pendiente. Si recuerdas algo, dímelo y lo anoto." />
      ) : (
        <div className="space-y-3">
          {open.map((p) => {
            const { icon: Icon, color } = getIcon(p.text);
            return (
              <button
                key={p.id}
                onClick={() => togglePending(p.id)}
                className="flex w-full items-center gap-4 p-4 text-left surface border-none shadow-sm rounded-2xl group active:scale-[0.98] transition-all"
              >
                <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", color)}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="block text-[16px] font-semibold text-foreground truncate">{p.text}</span>
                    <span className="whitespace-nowrap text-[12px] font-medium text-accent">Hoy</span>
                  </div>
                  <span className="block text-[13px] text-muted-foreground truncate">{p.clientId ? "John Smith · $120" : "Recordatorio"}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {done.length > 0 ? (
        <>
          <SectionTitle>Listos</SectionTitle>
          <div className="space-y-2 opacity-60">
            {done.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePending(p.id)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left"
              >
                <div className="size-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <Check className="size-5 text-success" />
                </div>
                <span className="flex-1 text-[15px] text-muted-foreground line-through truncate">{p.text}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </Screen>
  );
}
