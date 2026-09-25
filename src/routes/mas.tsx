import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wallet, Receipt, ListChecks, FileText, RotateCcw, ChevronRight, User, Settings, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, PageTitle, Screen, SectionTitle } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";

export const Route = createFileRoute("/mas")({
  head: () => ({
    meta: [
      { title: "Más — Marcelo" },
      { name: "description", content: "Tu dinero, gastos, pendientes y documentos para tu contador." },
      { property: "og:title", content: "Más — Marcelo" },
      { property: "og:description", content: "Tu dinero, gastos, pendientes y documentos." },
    ],
  }),
  component: Mas,
});

const mainLinks = [
  { to: "/dinero", label: "Tu dinero", hint: "Ingresos, gastos y ganancia", icon: Wallet, color: "text-blue-600 bg-blue-50" },
  { to: "/gastos", label: "Gastos", hint: "Anota lo que gastas", icon: Receipt, color: "text-red-600 bg-red-50" },
  { to: "/pendientes", label: "Pendientes", hint: "Cobros y recados", icon: ListChecks, color: "text-orange-600 bg-orange-50" },
  { to: "/documentos", label: "Documentos", hint: "Resumen para tu contador", icon: FileText, color: "text-success bg-success/10" },
] as const;

function Mas() {
  const navigate = useNavigate();
  const { state, reset } = useMarcelo();

  return (
    <Screen>
      <PageTitle title="Más opciones" />

      <div className="mb-8 flex items-center gap-4 p-4 surface border-none shadow-sm rounded-3xl">
        <div className="size-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
          <User className="size-8" />
        </div>
        <div>
          <h2 className="text-[18px] font-bold">{state.profile.name || "Carlos"}</h2>
          <p className="text-[14px] text-muted-foreground">{state.profile.trade || "Servicios profesionales"}</p>
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
              <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</span>
            </div>
          </button>
        ))}
      </div>

      <SectionTitle>Cuenta y seguridad</SectionTitle>
      <Card className="divide-y divide-border p-0 mb-8 border-none shadow-sm overflow-hidden rounded-3xl">
        <button className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-muted/30">
          <Settings className="size-5 text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Configuración</span>
          <ChevronRight className="size-4 text-muted-foreground/30" />
        </button>
        <button className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-muted/30">
          <ShieldCheck className="size-5 text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">Privacidad</span>
          <ChevronRight className="size-4 text-muted-foreground/30" />
        </button>
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
      
      <p className="mt-6 text-center text-[12px] text-muted-foreground">Versión 1.0.4 · Hecho con ♡</p>
    </Screen>
  );
}
