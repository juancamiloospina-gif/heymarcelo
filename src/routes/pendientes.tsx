import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Plus,
  ChevronRight,
  MessageSquare,
  House,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Empty, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, prettyDate, todayISO, type Pending } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pendientes")({
  head: () => ({
    meta: [
      { title: "Pendientes — Marcelo" },
      {
        name: "description",
        content: "Lo que no se te puede olvidar: cobros, visitas de regreso y recados.",
      },
      { property: "og:title", content: "Pendientes — Marcelo" },
      {
        property: "og:description",
        content: "Cobros, visitas de regreso y recados en una sola lista.",
      },
    ],
  }),
  component: Pendientes,
});

type Kind = "cobro" | "visita" | "papeleo" | "otro";

const kindOf = (p: Pending): Kind => {
  const t = p.text.toLowerCase();
  if (typeof p.amount === "number" || /cobrar|debe|dinero|pago/.test(t)) return "cobro";
  if (/volver|casa|visita|regresar/.test(t)) return "visita";
  if (/factura|enviar|recibo/.test(t)) return "papeleo";
  return "otro";
};

const kindStyle: Record<Kind, { icon: typeof AlertCircle; color: string }> = {
  cobro: { icon: AlertCircle, color: "bg-destructive/10 text-destructive" },
  visita: { icon: House, color: "bg-accent/10 text-accent" },
  papeleo: { icon: FileText, color: "bg-warning/15 text-warning-foreground" },
  otro: { icon: MessageSquare, color: "bg-muted text-muted-foreground" },
};

const tabs = [
  { key: "todos", label: "Todos", match: () => true },
  { key: "cobros", label: "Cobros", match: (k: Kind) => k === "cobro" },
  { key: "visitas", label: "Visitas", match: (k: Kind) => k === "visita" },
  { key: "otros", label: "Otros", match: (k: Kind) => k === "papeleo" || k === "otro" },
] as const;

const shortDate = (iso: string) => {
  if (iso === todayISO(-1)) return "Ayer";
  const pretty = prettyDate(iso);
  return pretty === "Hoy" || pretty === "Mañana"
    ? pretty
    : new Date(`${iso}T12:00:00`).toLocaleDateString("es-US", { day: "numeric", month: "short" });
};

function Pendientes() {
  const { state, togglePending, addPending, addPayment, clientById, clearDonePendings } =
    useMarcelo();
  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("todos");

  const tab = tabs.find((t) => t.key === activeTab) ?? tabs[0];
  const open = state.pendings.filter((p) => !p.done && tab.match(kindOf(p)));
  const done = state.pendings.filter((p) => p.done);

  const add = () => {
    if (!text.trim()) return;
    addPending(text.trim());
    setText("");
  };

  return (
    <Screen>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          aria-label="Atrás"
          className="text-muted-foreground"
        >
          <ChevronRight className="size-6 rotate-180" />
        </button>
      </div>

      <PageTitle title="Pendientes" />

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors",
              activeTab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="mb-6 flex items-center gap-2 border-none bg-muted/50 p-2 shadow-sm">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Agregar un pendiente"
          className="h-11 flex-1 rounded-lg bg-transparent px-3 text-[15px] outline-none"
        />
        <Button
          size="sm"
          aria-label="Agregar"
          className="rounded-xl"
          disabled={!text.trim()}
          onClick={add}
        >
          <Plus className="size-5" />
        </Button>
      </Card>

      {open.length === 0 ? (
        <Empty
          title="Todo al día."
          hint={
            activeTab === "todos"
              ? "No tienes nada pendiente. Si recuerdas algo, dímelo y lo anoto."
              : "No hay nada en esta lista."
          }
        />
      ) : (
        <div className="space-y-3">
          {open.map((p) => {
            const { icon: Icon, color } = kindStyle[kindOf(p)];
            const client = clientById(p.clientId);
            const detail = [
              client?.name,
              typeof p.amount === "number" ? money(p.amount) : undefined,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={p.id}
                onClick={() => {
                  togglePending(p.id);
                  const { clientId, amount } = p;
                  if (clientId && typeof amount === "number") {
                    toast.success("Marcado como listo", {
                      description: "¿Ya te pagó?",
                      action: {
                        label: `Registrar ${money(amount)}`,
                        onClick: () => {
                          addPayment({ clientId, amount, method: "efectivo", date: todayISO() });
                          toast.success(`Cobro registrado: ${money(amount)}`);
                        },
                      },
                    });
                  } else {
                    toast.success("Marcado como listo");
                  }
                }}
                className="surface group flex w-full items-center gap-4 rounded-2xl border-none p-4 text-left shadow-sm transition-all active:scale-[0.98]"
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    color,
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="block truncate text-[16px] font-semibold text-foreground">
                      {p.text}
                    </span>
                    <span className="whitespace-nowrap text-[12px] font-medium text-accent">
                      {shortDate(p.createdAt)}
                    </span>
                  </div>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {detail || "Recordatorio"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {done.length > 0 ? (
        <>
          <SectionTitle
            action={
              <button
                onClick={() => {
                  clearDonePendings();
                  toast.success("Lista limpia");
                }}
                className="text-[13px] font-semibold text-accent"
              >
                Borrar listos
              </button>
            }
          >
            Listos
          </SectionTitle>
          <div className="space-y-2 opacity-60">
            {done.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePending(p.id)}
                aria-label={`Volver a abrir: ${p.text}`}
                className="flex w-full items-center gap-4 px-4 py-3 text-left"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                  <Check className="size-5 text-success" />
                </div>
                <span className="flex-1 truncate text-[15px] text-muted-foreground line-through">
                  {p.text}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </Screen>
  );
}
