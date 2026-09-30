import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarOff, Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  BackButton,
  Button,
  Card,
  Chips,
  Field,
  PageTitle,
  Screen,
  SectionTitle,
} from "@/components/marcelo/kit";
import { Swipeable } from "@/components/marcelo/reminders";
import { ServiceIcon, serviceKinds } from "@/components/marcelo/visual";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  dayShort,
  money,
  prettyDate,
  sizeLabel,
  todayISO,
  type Service,
  type ServiceKind,
  type Size,
} from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/servicios")({
  head: () => ({
    meta: [
      { title: "Servicios y precios — Marcelo" },
      {
        name: "description",
        content: "Los precios y el horario que Marcelo usa para cotizar y agendar.",
      },
    ],
  }),
  component: Servicios,
});

const sizes: Size[] = ["chico", "mediano", "grande"];
const empty = {
  name: "",
  nameEn: "",
  price: "",
  minutes: "60",
  kind: "general" as ServiceKind,
  bySize: false,
  sizes: { chico: "", mediano: "", grande: "" } as Record<Size, string>,
};
const num = (s: string) => Number(s.replace(/[$,\s]/g, ""));

function Servicios() {
  const { state, addService, updateService, removeService, restoreService, setSettings } =
    useMarcelo();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [block, setBlock] = useState("");
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
            bySize: Boolean(s.sizes),
            sizes: s.sizes
              ? {
                  chico: String(s.sizes.chico),
                  mediano: String(s.sizes.mediano),
                  grande: String(s.sizes.grande),
                }
              : {
                  chico: String(Math.round(s.price * 0.75)),
                  mediano: String(s.price),
                  grande: String(Math.round(s.price * 1.5)),
                },
          }
        : empty,
    );
  };

  const valid =
    form.name.trim() &&
    (form.bySize ? sizes.every((k) => num(form.sizes[k]) > 0) : num(form.price) > 0);

  const save = () => {
    if (!valid) return;
    const bySize = form.bySize
      ? {
          chico: num(form.sizes.chico),
          mediano: num(form.sizes.mediano),
          grande: num(form.sizes.grande),
        }
      : undefined;
    const data = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || form.name.trim(),
      price: bySize ? bySize.mediano : num(form.price),
      sizes: bySize,
      minutes: Math.max(15, Number(form.minutes) || 60),
      kind: form.kind,
    };
    if (editing === "new") addService(data);
    else if (editing) updateService(editing, data);
    setEditing(null);
    toast.success("Precio guardado");
  };

  const remove = (s: Service) => {
    const removed = removeService(s.id);
    if (removed)
      toast(`${s.name} borrado`, {
        action: { label: "Deshacer", onClick: () => restoreService(removed) },
      });
  };

  const editor = (
    <Card className="space-y-4 border-accent/30">
      <div>
        <p className="mb-2 text-[14px] font-medium text-muted-foreground">Tipo de trabajo</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(serviceKinds) as ServiceKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setForm({ ...form, kind: k })}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-[12px] font-semibold",
                form.kind === k ? "border-accent bg-accent/5" : "border-border",
              )}
            >
              <ServiceIcon kind={k} size="sm" />
              {serviceKinds[k].label}
            </button>
          ))}
        </div>
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
      <Chips
        options={[
          { key: "flat", label: "Un solo precio" },
          { key: "size", label: "Precio por tamaño" },
        ]}
        value={form.bySize ? "size" : "flat"}
        onChange={(k) => setForm({ ...form, bySize: k === "size" })}
      />
      {form.bySize ? (
        <div className="grid grid-cols-3 gap-2">
          {sizes.map((k) => (
            <Field
              key={k}
              label={sizeLabel[k].es}
              inputMode="decimal"
              value={form.sizes[k]}
              onChange={(e) => setForm({ ...form, sizes: { ...form.sizes, [k]: e.target.value } })}
            />
          ))}
        </div>
      ) : (
        <Field
          label="Precio"
          inputMode="decimal"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          placeholder="$ 0"
        />
      )}
      <Field
        label="Minutos que tardas"
        inputMode="numeric"
        value={form.minutes}
        onChange={(e) => setForm({ ...form, minutes: e.target.value })}
      />
      {editing && editing !== "new" ? (
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            const svc = state.services.find((x) => x.id === editing);
            setEditing(null);
            if (svc) remove(svc);
          }}
        >
          <Trash2 className="size-5" /> Borrar servicio
        </Button>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setEditing(null)}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={!valid}>
          Guardar
        </Button>
      </div>
    </Card>
  );

  return (
    <Screen>
      <BackButton />
      <PageTitle title="Servicios y precios" subtitle="Marcelo solo cotiza estos precios." />

      <Card className="divide-y divide-border overflow-hidden p-0">
        {state.services.map((s) =>
          editing === s.id ? (
            <div key={s.id} className="p-2">
              {editor}
            </div>
          ) : (
            <Swipeable key={s.id} onLeft={() => remove(s)}>
              <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                <ServiceIcon kind={s.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-snug">{s.name}</p>
                  <p className="flex items-center gap-1 text-[14px] text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{s.minutes} min</span>
                    <span className="truncate">
                      ·{" "}
                      {s.sizes
                        ? `${money(s.sizes.chico)}–${money(s.sizes.grande)}`
                        : money(s.price)}
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => startEdit(s)}
                  aria-label={`Editar ${s.name}`}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
              </div>
            </Swipeable>
          ),
        )}
      </Card>
      <p className="mt-2 flex items-center gap-1.5 text-[14px] text-muted-foreground">
        <Trash2 className="size-4" /> Desliza a la izquierda para borrar.
      </p>
      {editing === "new" ? <div className="mt-3">{editor}</div> : null}
      {editing === null ? (
        <Button
          variant="secondary"
          className="mt-3 w-full border-dashed"
          onClick={() => startEdit()}
        >
          <Plus className="size-5" /> Agregar servicio
        </Button>
      ) : null}

      <SectionTitle>Horario para trabajos</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const h = settings.hours[d] ?? { on: false, start: "08:00", end: "17:00" };
          const set = (patch: Partial<typeof h>) =>
            setSettings({ hours: { ...settings.hours, [d]: { ...h, ...patch } } });
          return (
            <div key={d} className="flex min-h-14 items-center gap-2 px-3 py-2">
              <button
                aria-pressed={h.on}
                onClick={() => set({ on: !h.on })}
                className={cn(
                  "flex h-12 w-14 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold",
                  h.on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {dayShort[d]}
              </button>
              {h.on ? (
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <TimeInput label="Desde" value={h.start} onChange={(v) => set({ start: v })} />
                  <TimeInput label="Hasta" value={h.end} onChange={(v) => set({ end: v })} />
                </div>
              ) : (
                <p className="flex-1 text-[15px] text-muted-foreground">No trabajo</p>
              )}
            </div>
          );
        })}
      </Card>

      <SectionTitle>Tiempo entre trabajos</SectionTitle>
      <Chips
        options={[15, 30, 45, 60].map((m) => ({ key: String(m), label: `${m} min` }))}
        value={String(settings.bufferMin)}
        onChange={(v) => setSettings({ bufferMin: Number(v) })}
      />
      <p className="mt-2 text-[14px] text-muted-foreground">Para manejar de un trabajo al otro.</p>

      <SectionTitle>Días sin trabajo</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field
            label="Bloquear un día"
            type="date"
            min={todayISO()}
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          />
          <Button
            disabled={!block || settings.blocked.includes(block)}
            onClick={() => {
              setSettings({ blocked: [...settings.blocked, block].sort() });
              setBlock("");
            }}
          >
            <CalendarOff className="size-5" /> Bloquear
          </Button>
        </div>
        {settings.blocked.filter((d) => d >= todayISO()).length ? (
          <div className="flex flex-wrap gap-2">
            {settings.blocked
              .filter((d) => d >= todayISO())
              .map((d) => (
                <span
                  key={d}
                  className="flex h-10 items-center gap-1 rounded-full bg-muted pl-3 text-[15px]"
                >
                  {prettyDate(d)}
                  <button
                    aria-label={`Desbloquear ${prettyDate(d)}`}
                    onClick={() =>
                      setSettings({ blocked: settings.blocked.filter((x) => x !== d) })
                    }
                    className="flex size-10 items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                </span>
              ))}
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            Marcelo no ofrecerá esos días a tus clientes.
          </p>
        )}
      </Card>
    </Screen>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex h-12 items-center gap-1.5 rounded-xl border border-input bg-card px-2">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
      />
    </label>
  );
}
