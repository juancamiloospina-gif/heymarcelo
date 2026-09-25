import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { ServiceIcon, serviceKinds } from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
import { money, type Service, type ServiceKind } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/servicios")({
  head: () => ({
    meta: [
      { title: "Servicios y precios — Marcelo" },
      {
        name: "description",
        content: "Los precios que Marcelo usa para contestar a tus clientes y agendar citas.",
      },
    ],
  }),
  component: Servicios,
});

const days = ["D", "L", "M", "M", "J", "V", "S"];
const empty = { name: "", nameEn: "", price: "", minutes: "60", kind: "general" as ServiceKind };

function Servicios() {
  const { state, addService, updateService, removeService, setSettings } = useMarcelo();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const { settings } = state;

  const startEdit = (s?: Service) => {
    setEditing(s?.id ?? "new");
    setForm(
      s
        ? {
            name: s.name,
            nameEn: s.nameEn,
            price: String(s.price),
            minutes: String(s.minutes),
            kind: s.kind,
          }
        : empty,
    );
  };

  const save = () => {
    const data = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || form.name.trim(),
      price: Number(form.price.replace(/[$,\s]/g, "")),
      minutes: Math.max(15, Number(form.minutes) || 60),
      kind: form.kind,
    };
    if (!data.name || !(data.price > 0)) return;
    if (editing === "new") addService(data);
    else if (editing) updateService(editing, data);
    setEditing(null);
    toast.success("Precio guardado");
  };

  const editor = (
    <Card className="space-y-3 border-accent/30">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tipo de trabajo
      </p>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(serviceKinds) as ServiceKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setForm({ ...form, kind: k })}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-semibold",
              form.kind === k ? "border-accent bg-accent/5" : "border-border",
            )}
          >
            <ServiceIcon kind={k} size="sm" />
            {serviceKinds[k].label}
          </button>
        ))}
      </div>
      <Field
        label="Nombre"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Corte de pasto"
      />
      <Field
        label="Cómo se lo dice Marcelo a clientes en inglés"
        value={form.nameEn}
        onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
        placeholder="Lawn mowing"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Precio"
          inputMode="decimal"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          placeholder="$ 0"
        />
        <Field
          label="Minutos"
          inputMode="numeric"
          value={form.minutes}
          onChange={(e) => setForm({ ...form, minutes: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setEditing(null)}>
          Cancelar
        </Button>
        <Button
          onClick={save}
          disabled={!form.name.trim() || !(Number(form.price.replace(/[$,\s]/g, "")) > 0)}
        >
          Guardar
        </Button>
      </div>
    </Card>
  );

  return (
    <Screen>
      <button
        onClick={() => window.history.back()}
        aria-label="Atrás"
        className="mb-2 text-muted-foreground"
      >
        <ArrowLeft className="size-6" />
      </button>
      <PageTitle
        title="Servicios y precios"
        subtitle="Marcelo solo cotiza estos precios. Nunca da descuentos sin preguntarte."
      />

      <div className="space-y-2">
        {state.services.map((s) =>
          editing === s.id ? (
            <div key={s.id}>{editor}</div>
          ) : (
            <Card key={s.id} className="flex items-center gap-3 p-3 pl-4">
              <ServiceIcon kind={s.kind} />
              <button
                onClick={() => startEdit(s)}
                aria-label={`Editar ${s.name}`}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-[15px] font-semibold leading-snug">{s.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Clock className="size-3 shrink-0" />
                  <span className="shrink-0 whitespace-nowrap">{s.minutes} min</span>
                  <span className="truncate italic">· {s.nameEn}</span>
                </p>
              </button>
              <button onClick={() => startEdit(s)} className="text-right" aria-hidden tabIndex={-1}>
                <p className="text-[16px] font-bold">{money(s.price)}</p>
                <p className="flex items-center justify-end gap-0.5 text-[11px] font-semibold text-accent">
                  <Pencil className="size-3" /> Editar
                </p>
              </button>
              <button
                aria-label={`Borrar ${s.name}`}
                onClick={() => {
                  if (confirm(`¿Borrar ${s.name}?`)) removeService(s.id);
                }}
                className="-mr-1 rounded-full p-2 text-muted-foreground/60 hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ),
        )}
        {editing === "new" ? editor : null}
      </div>

      {editing === null ? (
        <Button
          variant="secondary"
          className="mt-3 w-full border-dashed"
          onClick={() => startEdit()}
        >
          <Plus className="size-4" /> Agregar servicio
        </Button>
      ) : null}

      <SectionTitle>Horario para citas</SectionTitle>
      <Card className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const on = settings.workDays.includes(i);
            return (
              <button
                key={i}
                aria-pressed={on}
                onClick={() =>
                  setSettings({
                    workDays: on
                      ? settings.workDays.filter((x) => x !== i)
                      : [...settings.workDays, i].sort(),
                  })
                }
                className={cn(
                  "flex h-10 items-center justify-center rounded-xl text-[13px] font-bold",
                  on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Empiezo"
            type="time"
            value={settings.workStart}
            onChange={(e) => setSettings({ workStart: e.target.value })}
          />
          <Field
            label="Termino"
            type="time"
            value={settings.workEnd}
            onChange={(e) => setSettings({ workEnd: e.target.value })}
          />
        </div>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Marcelo ofrece el primer espacio libre en este horario y deja 30 minutos entre trabajos
          para manejar.
        </p>
      </Card>
    </Screen>
  );
}
