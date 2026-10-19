import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, MessagesSquare, Wallet, Mic } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant";
import { useMarcelo } from "@/lib/marcelo-store";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/bandeja", label: "Mensajes", icon: MessagesSquare },
  { to: "/dinero", label: "Dinero", icon: Wallet },
] as const;

const LONG_PRESS_MS = 500;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open } = useAssistant();
  const navigate = useNavigate();
  const { state } = useMarcelo();
  const press = useRef<{ timer: number; long: boolean } | null>(null);
  // Full-screen conversations have their own back button and input bar at the bottom.
  const hideNav =
    pathname.startsWith("/mensaje/") || /^\/bandeja\/.+/.test(pathname) || pathname === "/traducir";
  const waiting =
    state.conversations.filter((c) => c.unread || c.stage === "tu_turno").length +
    state.outbox.length;
  const owed = state.receivables.filter((r) => !r.paidAt).length;

  // Tap: talk to Marcelo. Long press: straight to the translator.
  const down = () => {
    press.current = {
      long: false,
      timer: window.setTimeout(() => {
        if (press.current) press.current.long = true;
        navigator.vibrate?.(20);
        navigate({ to: "/traducir" });
      }, LONG_PRESS_MS),
    };
  };
  const up = () => {
    if (!press.current) return;
    window.clearTimeout(press.current.timer);
    if (!press.current.long) open();
    press.current = null;
  };

  return (
    <div className="min-h-screen bg-muted">
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-clip bg-background shadow-[var(--shadow-lift)]"
        style={state.settings.largeText ? { zoom: 1.15 } : undefined}
      >
        {/* Soft corner glows behind the content: pale blue top-left, pale orange top-right. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden"
        >
          <div className="absolute -left-16 -top-20 size-56 rounded-full bg-sky/12 blur-3xl" />
          <div className="absolute -right-16 -top-16 size-52 rounded-full bg-accent/12 blur-3xl" />
        </div>
        <main className="relative flex-1">{children}</main>

        <nav
          className={cn(
            "sticky bottom-0 z-30 bg-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            hideNav && "hidden",
          )}
        >
          <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-center rounded-full border border-border/60 bg-card/95 px-3 py-2 shadow-[var(--shadow-lift)] backdrop-blur-xl">
            {items.slice(0, 2).map((i) => (
              <NavItem key={i.to} {...i} active={isActive(pathname, i.to)} />
            ))}
            <div className="flex justify-center px-2">
              <button
                onPointerDown={down}
                onPointerUp={up}
                onPointerLeave={() => press.current && window.clearTimeout(press.current.timer)}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Hablar con Marcelo (mantén pulsado para traducir)"
                className="-my-3 flex size-16 select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-lift)] ring-[3px] ring-accent ring-offset-[3px] ring-offset-card transition-transform active:scale-95"
              >
                <Mic className="size-7" />
              </button>
            </div>
            {items.slice(2).map((i) => (
              <NavItem
                key={i.to}
                {...i}
                active={isActive(pathname, i.to)}
                badge={i.to === "/bandeja" ? waiting : i.to === "/dinero" ? owed : 0}
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (to === "/bandeja") return pathname.startsWith("/bandeja") || pathname.startsWith("/clientes");
  return pathname.startsWith(to);
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  badge = 0,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[12px] font-semibold transition-colors",
        active ? "text-sky" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
        {badge > 0 ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
      {active ? (
        <span aria-hidden className="absolute -bottom-0.5 h-[3px] w-5 rounded-full bg-accent" />
      ) : null}
    </Link>
  );
}
