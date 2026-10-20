import { useNavigate } from "@tanstack/react-router";
import { User } from "lucide-react";
import character from "@/assets/marcelo-character.png";
import { useMarcelo } from "@/lib/marcelo-store";
import { cn } from "@/lib/utils";

/**
 * The user's picture: their own photo once they set one (Mi perfil / Mi página), otherwise a
 * round placeholder. One component so the photo shows the same on every screen.
 */
export function UserPhoto({
  className,
  fallback = "character",
}: {
  className?: string;
  fallback?: "character" | "person";
}) {
  const { state } = useMarcelo();
  const url = state.profile.photoUrl;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-sky",
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover object-top" />
      ) : fallback === "person" ? (
        <User className="size-1/2" strokeWidth={1.8} />
      ) : (
        <img src={character} alt="" aria-hidden className="size-[92%] object-contain" />
      )}
    </span>
  );
}

/** Top-right avatar of the main screens; opens the profile and settings. */
export function MascotAvatar({ className }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/configuracion" })}
      aria-label="Perfil y configuración"
      className={cn(
        "shrink-0 rounded-full shadow-[var(--shadow-card)] ring-2 ring-card",
        className,
      )}
    >
      <UserPhoto className="size-12" />
    </button>
  );
}
