import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, Users, LayoutGrid, Mic } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/mas", label: "Más", icon: LayoutGrid },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open } = useAssistant();

  return (
    <div className="min-h-screen bg-muted">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-[var(--shadow-lift)]">
        <main className="flex-1">{children}</main>

        <nav className="sticky bottom-0 z-30 bg-transparent px-4 pb-4">
          <div className="grid grid-cols-5 items-center rounded-[1.75rem] border border-border bg-card/90 px-2 py-2 shadow-[var(--shadow-lift)] backdrop-blur-xl">
            {items.slice(0, 2).map((i) => (
              <NavItem key={i.to} {...i} active={isActive(pathname, i.to)} />
            ))}
            <div className="flex justify-center">
              <button
                onClick={() => open()}
                aria-label="Hablar con Marcelo"
                className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-[var(--shadow-card)] transition-transform active:scale-95"
              >
                <Mic className="size-5" />
              </button>
            </div>
            {items.slice(2).map((i) => (
              <NavItem key={i.to} {...i} active={isActive(pathname, i.to)} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
        active ? "text-accent" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  );
}
