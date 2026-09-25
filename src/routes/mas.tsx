import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Wallet,
  Receipt,
  ListChecks,
  FileText,
  RotateCcw,
  ChevronDown,
  User,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { todayISO } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";
import { useMarcelo } from "@/lib/marcelo-store";

export const Route = createFileRoute("/mas")({
  head: () => ({
    meta: [
      { title: "Más — Marcelo" },
      {
        name: "description",
        content: "Tu dinero, gastos, pendientes y documentos para tu contador.",
      },
      { property: "og:title", content: "Más — Marcelo" },
      { property: "og:description", content: "Tu dinero, gastos, pendientes y documentos." },
    ],
  }),
  component: Mas,
});

const mainLinks = [
  {
    to: "/dinero",
    label: "Tu dinero",
    hint: "Ingresos, gastos y ganancia",
    icon: Wallet,
    color: "text-accent bg-accent/10",
  },
  {
    to: "/gastos",
    label: "Gastos",
    hint: "Anota lo que gastas",
    icon: Receipt,
    color: "text-destructive bg-destructive/10",
  },
  {
    to: "/pendientes",
    label: "Pendientes",
    hint: "Cobros y recados",
    icon: ListChecks,
    color: "text-warning-foreground bg-warning/15",
  },
  {
    to: "/documentos",
    label: "Documentos",
    hint: "Resumen para tu contador",
    icon: FileText,
    color: "text-success bg-success/10",
  },
] as const;

function Mas() {
  const navigate = useNavigate();
  const { state, reset, setProfile } = useMarcelo();
  const [section, setSection] = useState<"config" | "privacidad" | null>(null);
  const [form, setForm] = useState(state.profile);

  const toggle = (next: "config" | "privacidad") => {
    if (next === "config") setForm(state.profile);
    setSection((cur) => (cur === next ? null : next));
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marcelo-copia-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Copia descargada");
  };

  return (
    <Screen>
      <PageTitle title="Más opciones" />

      <div className="mb-8 flex items-center gap-4 p-4 surface border-none shadow-sm rounded-3xl">
        <div className="size-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
          <User className="size-8" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold">{state.profile.name || "Tu perfil"}</h2>
          <p className="text-[14px] text-muted-foreground">
            {[state.profile.trade || "Servicios profesionales", state.profile.city]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <SectionTitle>Herramientas</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {mainLinks.map(({ to, label, hint, icon: Icon, color }) => (
          <button
            key={to}
            onClick={() => navigate({ to })}
            className="flex flex-col gap-3 p-4 surface border-none shadow-sm rounded-3xl text-left active:scale-[0.98] transition-all"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${color}`}>
              <Icon className="size-5" />
            </span>
            <div>
              <span className="block text-[15px] font-bold">{label}</span>
              <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                {hint}
              </span>
            </div>
          </button>
        ))}
      </div>

      <SectionTitle>Cuenta y seguridad</SectionTitle>
      <Card className="divide-y divide-border p-0 mb-8 border-none shadow-sm overflow-hidden rounded-3xl">
        <button
          onClick={() => toggle("config")}
          aria-expanded={section === "config"}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30"
        >
          <Settings className="size-5 text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Configuración</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground/40 transition-transform",
              section === "config" && "rotate-180",
            )}
          />
        </button>
        {section === "config" ? (
          <form
            className="space-y-3 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              setProfile({
                name: form.name.trim(),
                trade: form.trade.trim(),
                city: form.city.trim(),
              });
              setSection(null);
              toast.success("Perfil guardado");
            }}
          >
            <Field
              label="Tu nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              label="¿A qué te dedicas?"
              value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
            />
            <Field
              label="Ciudad"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Button type="submit" className="w-full" disabled={!form.name.trim()}>
              Guardar
            </Button>
          </form>
        ) : null}
        <button
          onClick={() => toggle("privacidad")}
          aria-expanded={section === "privacidad"}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30"
        >
          <ShieldCheck className="size-5 text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Privacidad</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground/40 transition-transform",
              section === "privacidad" && "rotate-180",
            )}
          />
        </button>
        {section === "privacidad" ? (
          <div className="space-y-3 px-5 py-4 text-[14px] leading-relaxed text-muted-foreground">
            <p>Tus clientes, cobros y gastos se guardan solo en este teléfono. Nadie más los ve.</p>
            <p>
              Cuando hablas con Marcelo, lo que dices y un resumen de tus datos se envían para
              preparar la respuesta. No se guardan.
            </p>
            <p>
              Si borras los datos del navegador o cambias de teléfono, se pierden. Descarga una
              copia de vez en cuando.
            </p>
            <Button variant="secondary" className="w-full" onClick={downloadBackup}>
              Descargar mis datos
            </Button>
          </div>
        ) : null}
      </Card>

      <Button
        variant="secondary"
        className="w-full h-14 rounded-2xl border-none shadow-sm text-destructive"
        onClick={() => {
          if (confirm("¿Estás seguro de que quieres borrar todos los datos?")) {
            reset();
            toast.success("Marcelo empezó de nuevo");
          }
        }}
      >
        <RotateCcw className="size-5" /> Empezar de nuevo
      </Button>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        Versión 1.1.0 · Hecho con ♡
      </p>
    </Screen>
  );
}
