import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pb-28 pt-5", className)}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[22px] font-bold leading-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-1 text-[16px] text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-baseline justify-between first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "surface w-full p-4 text-left",
        onClick && "transition-shadow active:scale-[0.995] hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "md" | "sm";
};

export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-50",
        size === "md" ? "h-12 px-5 text-[16px]" : "h-12 px-4 text-[15px]",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "accent" && "bg-accent text-accent-foreground hover:bg-accent/90",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted",
        variant === "danger" &&
          "border border-destructive/30 bg-card text-destructive hover:bg-destructive/5",
        className,
      )}
    />
  );
}

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">{label}</span>
      <input
        {...props}
        className={cn(
          "h-12 w-full rounded-2xl border border-input bg-card px-4 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/25",
          className,
        )}
      />
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "success" && "bg-success/12 text-success",
        tone === "warning" && "bg-warning/18 text-warning-foreground",
        tone === "danger" && "bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="py-8 text-center">
      <p className="text-[16px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    </Card>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  right,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      {icon ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[13px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {right}
    </Tag>
  );
}

/** The one back control used on every screen. */
export function BackButton({ onClick, label = "Atrás" }: { onClick?: () => void; label?: string }) {
  return (
    <button
      onClick={onClick ?? (() => window.history.back())}
      className="-ml-2 mb-3 flex h-12 items-center gap-1.5 px-2 text-[16px] font-semibold text-foreground"
    >
      <ArrowLeft className="size-5" /> {label}
    </button>
  );
}

/** Bottom sheet for quick decisions (Terminé, Cobré, Responder…). */
export function Sheet({
  title,
  onClose,
  children,
  icon,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-card p-5 pb-8 shadow-[var(--shadow-lift)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[18px] font-bold">
            {icon}
            {title}
          </p>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-12 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Segmented tabs (Resumen · Por cobrar · Gastos · Contador…). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors",
            value === t.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {t.label}
          {t.badge ? (
            <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-foreground">
              {t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Choice chips (método de pago, tamaño, categoría). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string; icon?: ReactNode }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cn(
            "flex h-12 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition-colors",
            value === o.key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
