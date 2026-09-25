import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wallet, Receipt, ListChecks, FileText, RotateCcw, ChevronRight } from "lucide-react";
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

const links = [
  { to: "/dinero", label: "Tu dinero", hint: "Ingresos, gastos y ganancia", icon: Wallet },
  { to: "/gastos", label: "Gastos", hint: "Anota lo que gastas", icon: Receipt },
  { to: "/pendientes", label: "Pendientes", hint: "Cobros y recados", icon: ListChecks },
  { to: "/documentos", label: "Documentos", hint: "Resumen para tu contador", icon: FileText },
] as const;

function Mas() {
  const navigate = useNavigate();
  const { state, reset } = useMarcelo();

  return (
    <Screen>
      <PageTitle title="Más" subtitle={`${state.profile.name || "Carlos"} · ${state.profile.trade || "Servicios"}`} />

      <Card className="divide-y divide-border p-0">
        {links.map(({ to, label, hint, icon: Icon }) => (
          <button key={to} onClick={() => navigate({ to })} className="flex w-full items-center gap-3 px-4 py-4 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-accent">
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{label}</span>
              <span className="block text-[13px] text-muted-foreground">{hint}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </Card>

      <SectionTitle>Tu perfil</SectionTitle>
      <Card className="space-y-2 text-[15px]">
        <p>{state.profile.name || "Carlos"}</p>
        <p className="text-muted-foreground">{state.profile.trade || "Jardinería y mantenimiento"}</p>
        <p className="text-muted-foreground">{state.profile.city || "Los Ángeles, CA"}</p>
      </Card>

      <Button
        variant="secondary"
        className="mt-5 w-full"
        onClick={() => {
          reset();
          toast.success("Marcelo empezó de nuevo");
        }}
      >
        <RotateCcw className="size-4" /> Empezar de nuevo
      </Button>
    </Screen>
  );
}
