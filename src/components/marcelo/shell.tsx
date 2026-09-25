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
    <div className="min-h-screen bg-muted/40">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-[var(--shadow-lift)]">
        <main className="flex-1">{children}</main>

        <nav className="sticky bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
          <div className="grid grid-cols-5 items-end px-2 pb-3 pt-2">
            {items.slice(0, 2).map((i) => (
              <NavItem key={i.to} {...i} active={isActive(pathname, i.to)} />
            ))}
            <div className="flex justify-center">
              <button
                onClick={() => open()}
                aria-label="Hablar con Marcelo"
                className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
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
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  );
}
