import {
  Car,
  Droplets,
  Flower2,
  Fuel,
  Hammer,
  Leaf,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Package,
  Scissors,
  Sparkles,
  Sprout,
  Wrench,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { Channel, ConversationStage, Expense, ServiceKind } from "@/lib/marcelo-data";
import { cn } from "@/lib/utils";

export type Tone =
  "accent" | "success" | "warning" | "danger" | "teal" | "plum" | "sky" | "neutral";

/** Soft tinted chip: tinted background + solid icon color. Literal classes so Tailwind keeps them. */
export const toneChip: Record<Tone, string> = {
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/18 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  teal: "bg-teal/12 text-teal",
  plum: "bg-plum/12 text-plum",
  sky: "bg-sky/12 text-sky",
  neutral: "bg-muted text-muted-foreground",
};

export const toneBar: Record<Tone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  teal: "bg-teal",
  plum: "bg-plum",
  sky: "bg-sky",
  neutral: "bg-muted-foreground",
};

export const serviceKinds: Record<ServiceKind, { label: string; icon: LucideIcon; tone: Tone }> = {
  pasto: { label: "Pasto", icon: Sprout, tone: "success" },
  poda: { label: "Poda", icon: Scissors, tone: "teal" },
  limpieza: { label: "Limpieza", icon: Leaf, tone: "warning" },
  riego: { label: "Riego", icon: Droplets, tone: "sky" },
  plantas: { label: "Plantas", icon: Flower2, tone: "plum" },
  reparacion: { label: "Reparación", icon: Wrench, tone: "danger" },
  general: { label: "General", icon: Sparkles, tone: "accent" },
};

export const expenseVisual: Record<Expense["category"], { icon: LucideIcon; tone: Tone }> = {
  Gasolina: { icon: Fuel, tone: "danger" },
  Herramientas: { icon: Hammer, tone: "teal" },
  Materiales: { icon: Package, tone: "warning" },
  Vehículo: { icon: Car, tone: "sky" },
  Publicidad: { icon: Megaphone, tone: "plum" },
  Otros: { icon: MoreHorizontal, tone: "neutral" },
};

export const channelVisual: Record<
  Channel,
  { label: string; icon: LucideIcon; chip: string; text: string }
> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    chip: "bg-whatsapp/12 text-whatsapp",
    text: "text-whatsapp",
  },
  sms: { label: "SMS", icon: MessageSquareText, chip: "bg-sky/12 text-sky", text: "text-sky" },
};

export const stageLabel: Record<
  ConversationStage,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  nuevo: { label: "Nuevo", tone: "neutral" },
  cotizado: { label: "Precio enviado", tone: "warning" },
  agendado: { label: "Agendado", tone: "success" },
  rechazado: { label: "No aceptó", tone: "neutral" },
  tu_turno: { label: "Te necesita", tone: "danger" },
  manual: { label: "Lo llevas tú", tone: "neutral" },
};

export function ChannelDot({ channel }: { channel: Channel }) {
  const { icon: Icon, text } = channelVisual[channel];
  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-card ring-2 ring-card",
        text,
      )}
    >
      <Icon className="size-3" />
    </span>
  );
}

export function IconChip({
  icon: Icon,
  tone = "accent",
  className,
  size = "md",
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" && "size-8 rounded-lg",
        size === "md" && "size-10 rounded-xl",
        size === "lg" && "size-12 rounded-2xl",
        toneChip[tone],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5"} />
    </span>
  );
}

export function ServiceIcon({
  kind,
  size = "md",
}: {
  kind: ServiceKind | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const v = serviceKinds[kind ?? "general"];
  return <IconChip icon={v.icon} tone={v.tone} size={size} />;
}

const avatarTones: Tone[] = ["accent", "teal", "plum", "success", "sky", "warning"];

export function ClientAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hash = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const tone = avatarTones[hash % avatarTones.length] ?? "accent";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" && "size-9 text-[12px]",
        size === "md" && "size-11 text-[14px]",
        size === "lg" && "size-16 text-[20px]",
        toneChip[tone],
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  const v = channelVisual[channel];
  const Icon = v.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        v.chip,
      )}
    >
      <Icon className="size-3" />
      {v.label}
    </span>
  );
}
