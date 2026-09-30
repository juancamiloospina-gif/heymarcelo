import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  BackButton,
  Button,
  Card,
  Empty,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
} from "@/components/marcelo/kit";
import { ReminderRow } from "@/components/marcelo/reminders";
import { useMarcelo } from "@/lib/marcelo-store";

export const Route = createFileRoute("/pendientes")({
  head: () => ({
    meta: [
      { title: "Recordatorios — Marcelo" },
      {
        name: "description",
        content: "Lo que no se te puede olvidar: volver donde un cliente, facturas, compras.",
      },
    ],
  }),
  component: Recordatorios,
});

function Recordatorios() {
  const { state, addPending, clearDonePendings } = useMarcelo();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  const open = [...state.pendings.filter((p) => !p.done)].sort((a, b) =>
    (a.due ?? "9999").localeCompare(b.due ?? "9999"),
  );
  const done = state.pendings.filter((p) => p.done);
  const owed = state.receivables.filter((r) => !r.paidAt).length;

  const add = () => {
    if (!text.trim()) return;
    addPending(text.trim(), due ? { due } : {});
    setText("");
    setDue("");
    toast.success("Recordatorio agregado");
  };

  return (
    <Screen>
      <BackButton />
      <PageTitle title="Recordatorios" subtitle="Desliza a la derecha para completar." />

      <Card className="mb-5 space-y-3">
        <Field
          label="Nuevo recordatorio"
          value={text}
          placeholder="Ej. Volver donde Sarah"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field
            label="Para cuándo (opcional)"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <Button onClick={add} disabled={!text.trim()}>
            <Plus className="size-5" /> Agregar
          </Button>
        </div>
      </Card>

      {owed ? (
        <Card
          className="mb-5 flex items-center gap-3"
          onClick={() => navigate({ to: "/dinero", search: { tab: "cobrar" } })}
        >
          <HandCoins className="size-5 text-warning-foreground" />
          <p className="flex-1 text-[15px]">Los cobros están en Dinero → Por cobrar ({owed})</p>
        </Card>
      ) : null}

      {open.length === 0 ? (
        <Empty title="Todo al día." hint="Si recuerdas algo, díselo a Marcelo o escríbelo aquí." />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {open.map((p) => (
            <ReminderRow key={p.id} pending={p} />
          ))}
        </Card>
      )}

      {done.length > 0 ? (
        <>
          <SectionTitle
            action={
              <button
                onClick={clearDonePendings}
                className="h-10 text-[15px] font-semibold text-accent"
              >
                Borrar listos
              </button>
            }
          >
            Listos
          </SectionTitle>
          <Card className="divide-y divide-border overflow-hidden p-0 opacity-70">
            {done.map((p) => (
              <ReminderRow key={p.id} pending={p} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
