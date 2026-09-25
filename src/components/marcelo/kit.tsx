import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pb-28 pt-5", className)}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[22px] font-bold leading-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-1 text-[14px] text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-baseline justify-between first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h2>
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
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
};

export function Button({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-50",
        size === "md" ? "h-12 px-5 text-[15px]" : "h-10 px-4 text-[14px]",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted",
        variant === "danger" && "border border-destructive/30 bg-card text-destructive hover:bg-destructive/5",
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
      <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">{label}</span>
      <input
        {...props}
        className={cn(
          "h-12 w-full rounded-2xl border border-input bg-card px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/25",
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
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground">{hint}</p>
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
        {subtitle ? <span className="block truncate text-[13px] text-muted-foreground">{subtitle}</span> : null}
      </span>
      {right}
    </Tag>
  );
}
