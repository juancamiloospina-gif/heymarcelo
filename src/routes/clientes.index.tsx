import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Plus, ChevronRight } from "lucide-react";
import { Button, Card, Empty, Field, PageTitle, Screen } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { ClientAvatar } from "@/components/marcelo/visual";
import { money } from "@/lib/marcelo-data";

export const Route = createFileRoute("/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Marcelo" },
      {
        name: "description",
        content: "Tus clientes, sus servicios habituales y sus precios, siempre a la mano.",
      },
      { property: "og:title", content: "Clientes — Marcelo" },
      {
        property: "og:description",
        content: "Tus clientes, sus servicios habituales y sus precios.",
      },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  const { state, addClient } = useMarcelo();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    service: "",
    price: "",
  });
  const navigate = useNavigate();

  const list = state.clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Screen>
      <div className="flex items-start justify-between">
        <PageTitle title="Clientes" subtitle={`${state.clients.length} personas`} />
        <Button size="sm" aria-label="Agregar cliente" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente"
          className="h-11 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-[14px] outline-none focus:border-accent"
        />
      </div>

      {list.length === 0 ? (
        <Empty
          title="No encontré ese cliente."
          hint="Agrégalo aquí abajo o dile a Marcelo quién es."
        />
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ to: "/clientes/$clientId", params: { clientId: c.id } })}
              className="surface flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <ClientAvatar name={c.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {c.service}
                  {c.city ? ` · ${c.city.replace(", CA", "")}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
                {c.price ? `${money(c.price)} habitual` : ""}
                <ChevronRight className="size-4" />
              </span>
            </button>
          ))}
        </div>
      )}

      {adding ? (
        <Card className="mt-5 space-y-3">
          <p className="text-[15px] font-semibold">Nuevo cliente</p>
          <Field
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Field
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Field
            label="Ciudad"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <Field
            label="Servicio habitual"
            value={form.service}
            onChange={(e) => setForm({ ...form, service: e.target.value })}
          />
          <Field
            label="Precio habitual"
            inputMode="numeric"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              disabled={!form.name.trim()}
              onClick={() => {
                const c = addClient({ ...form, price: Number(form.price) || 0 });
                setAdding(false);
                setForm({ name: "", phone: "", address: "", city: "", service: "", price: "" });
                navigate({ to: "/clientes/$clientId", params: { clientId: c.id } });
              }}
            >
              Guardar
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      ) : null}
    </Screen>
  );
}
