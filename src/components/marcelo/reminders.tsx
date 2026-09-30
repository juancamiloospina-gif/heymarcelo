import { useRef, useState, type ReactNode } from "react";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMarcelo } from "@/lib/marcelo-store";
import { daysBetween, prettyDate, todayISO, type Pending } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

const SWIPE_PX = 90;

/**
 * Horizontal swipe for list rows: right completes / left deletes, with the action revealed
 * underneath. Taps still reach the row's own buttons.
 */
export function Swipeable({
  children,
  onRight,
  onLeft,
  rightLabel = "Listo",
  leftLabel = "Borrar",
}: {
  children: ReactNode;
  onRight?: (() => void) | undefined;
  onLeft?: (() => void) | undefined;
  rightLabel?: string;
  leftLabel?: string;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);

  return (
    <div className="relative overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 flex items-center px-5 text-[15px] font-semibold text-white",
          dx > 0 ? "justify-start bg-success" : "justify-end bg-destructive",
        )}
        aria-hidden
      >
        {dx > 0 ? (
          <span className="flex items-center gap-2">
            <Check className="size-5" /> {rightLabel}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {leftLabel} <Trash2 className="size-5" />
          </span>
        )}
      </div>
      <div
        className="relative bg-card transition-transform"
        style={{
          transform: `translateX(${dx}px)`,
          transitionDuration: start.current ? "0ms" : "200ms",
        }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
          horizontal.current = false;
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const x = e.clientX - start.current.x;
          const y = e.clientY - start.current.y;
          if (!horizontal.current && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y))
            horizontal.current = true;
          if (!horizontal.current) return;
          if ((x > 0 && !onRight) || (x < 0 && !onLeft)) return;
          setDx(Math.max(-140, Math.min(140, x)));
        }}
        onPointerUp={() => {
          const d = dx;
          start.current = null;
          setDx(0);
          if (d > SWIPE_PX) onRight?.();
          else if (d < -SWIPE_PX) onLeft?.();
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function dueLabel(p: Pending) {
  if (!p.due) return null;
  const d = daysBetween(p.due, todayISO());
  if (d > 0) return { text: `Vencido hace ${d} ${d === 1 ? "día" : "días"}`, late: true };
  if (d === 0) return { text: "Vence hoy", late: true };
  return { text: `Para ${prettyDate(p.due).toLowerCase()}`, late: false };
}

/** One reminder: a real checkbox, swipe right to complete, swipe left to delete (with undo). */
export function ReminderRow({ pending: p }: { pending: Pending }) {
  const { togglePending, clientById, removePending, restorePending } = useMarcelo();
  const due = dueLabel(p);
  const client = clientById(p.clientId);
  const complete = () => {
    togglePending(p.id);
    if (!p.done)
      toast.success("Recordatorio listo", {
        action: { label: "Deshacer", onClick: () => togglePending(p.id) },
      });
  };
  return (
    <Swipeable
      onRight={p.done ? undefined : complete}
      onLeft={() => {
        const removed = removePending(p.id);
        if (removed)
          toast("Recordatorio borrado", {
            action: { label: "Deshacer", onClick: () => restorePending(removed) },
          });
      }}
    >
      <div className="flex min-h-14 items-center gap-3 px-4 py-3">
        <button
          role="checkbox"
          aria-checked={p.done}
          aria-label={p.done ? `Marcar pendiente: ${p.text}` : `Completar: ${p.text}`}
          onClick={complete}
          className="flex size-12 shrink-0 items-center justify-center -ml-3"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-md border-2",
              p.done ? "border-success bg-success text-white" : "border-muted-foreground/40",
            )}
          >
            {p.done ? <Check className="size-4" /> : null}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[16px] leading-snug",
              p.done && "text-muted-foreground line-through",
            )}
          >
            {p.text}
          </p>
          {client || due ? (
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              {client?.name}
              {client && due ? " · " : ""}
              {due ? (
                <span className={due.late && !p.done ? "font-semibold text-destructive" : ""}>
                  {due.text}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </Swipeable>
  );
}
