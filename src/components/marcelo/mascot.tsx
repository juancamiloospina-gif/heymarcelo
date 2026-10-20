import { useNavigate } from "@tanstack/react-router";
import character from "@/assets/marcelo-character.png";
import { cn } from "@/lib/utils";

/** Marcelo's character in a light-blue circle; opens the profile and settings. */
export function MascotAvatar({ className }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/configuracion" })}
      aria-label="Perfil y configuración"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft shadow-[var(--shadow-card)] ring-2 ring-card",
        className,
      )}
    >
      <img src={character} alt="" aria-hidden className="size-11 object-contain" />
    </button>
  );
}
