import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button, Card, Empty, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";

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

  const open = state.pendings.filter((p) => !p.done);
  const done = state.pendings.filter((p) => p.done);

  return (
    <Screen>
      <PageTitle title="Pendientes" subtitle="Lo que no se te puede olvidar." />

      <Card className="flex items-center gap-2 p-2">
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
          disabled={!text.trim()}
          onClick={() => {
            addPending(text.trim());
            setText("");
          }}
        >
          <Plus className="size-4" />
        </Button>
      </Card>

      <SectionTitle>Por hacer</SectionTitle>
      {open.length === 0 ? (
        <Empty title="Todo al día." hint="No tienes nada pendiente. Si recuerdas algo, dímelo y lo anoto." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {open.map((p) => (
            <button key={p.id} onClick={() => togglePending(p.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <span className="size-5 shrink-0 rounded-md border-2 border-border" />
              <span className="flex-1 text-[15px]">{p.text}</span>
            </button>
          ))}
        </Card>
      )}

      {done.length > 0 ? (
        <>
          <SectionTitle>Listos</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {done.map((p) => (
              <button key={p.id} onClick={() => togglePending(p.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-success text-success-foreground">
                  <Check className="size-3.5" />
                </span>
                <span className="flex-1 text-[15px] text-muted-foreground line-through">{p.text}</span>
              </button>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
