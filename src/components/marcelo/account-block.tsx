import { useEffect, useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  enabledProviders,
  sendCode,
  signInWithProvider,
  signOut,
  verifyCode,
  type SocialProvider,
} from "@/lib/cloud";
import { cn } from "@/lib/utils";

/** Simple one-color marks for the sign-in buttons. */
const Google = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
    <path d="M21.35 11.1H12v2.9h5.35c-.23 1.4-1.6 4.1-5.35 4.1-3.2 0-5.8-2.65-5.8-5.9s2.6-5.9 5.8-5.9c1.8 0 3.05.78 3.75 1.45l2.55-2.45C16.7 3.9 14.6 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.05-1.05-.3-1.1z" />
  </svg>
);
const Apple = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);
const Microsoft = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
    <path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z" />
  </svg>
);

const PROVIDERS: { id: SocialProvider; label: string; icon: React.ReactNode }[] = [
  { id: "google", label: "Continuar con Google", icon: <Google /> },
  { id: "apple", label: "Continuar con Apple", icon: <Apple /> },
  { id: "azure", label: "Continuar con Microsoft", icon: <Microsoft /> },
];

/**
 * "Crea tu cuenta" in the first onboarding step: Google, Apple, Microsoft (Outlook / Office) or an
 * e-mail code. `email` is set once the user is signed in. Not a <form>: it lives inside one.
 */
export function AccountBlock({
  email,
  onBeforeLeave,
}: {
  email: string | null;
  /** Called right before leaving for a provider's page (to save what was typed). */
  onBeforeLeave: () => void;
}) {
  const [on, setOn] = useState<Record<SocialProvider, boolean> | null>(null);
  const [mode, setMode] = useState<"buttons" | "email" | "code">("buttons");
  const [mail, setMail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void enabledProviders().then(setOn);
  }, []);

  if (email) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-success/10 p-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-5" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">Cuenta conectada</p>
          <p className="truncate text-[14px] text-muted-foreground">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="h-10 shrink-0 px-2 text-[14px] font-bold text-sky"
        >
          Cambiar
        </button>
      </div>
    );
  }

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast.error(fail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[15px] leading-snug text-muted-foreground">
        <b className="text-foreground">Crea tu cuenta para continuar.</b> Con ella recibes
        solicitudes de clientes y publicas tu página.
      </p>

      {mode === "buttons" ? (
        <>
          {PROVIDERS.map((p) => {
            const off = on !== null && !on[p.id];
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy || off}
                onClick={() => {
                  onBeforeLeave();
                  void run(
                    () => signInWithProvider(p.id),
                    "Ese método todavía no está activado. Usa tu correo.",
                  );
                }}
                className={cn(
                  "flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-[16px] font-bold shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]",
                  off && "opacity-45",
                )}
              >
                {p.icon}
                {p.label}
                {off ? <span className="text-[12px] font-semibold">(pronto)</span> : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMode("email")}
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border-2 border-sky text-[16px] font-bold text-sky"
          >
            <Mail className="size-5" /> Usar mi correo
          </button>
        </>
      ) : mode === "email" ? (
        <div className="space-y-2.5">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            placeholder="tu@correo.com"
            aria-label="Tu correo"
            className="h-14 w-full rounded-full border-2 border-border bg-card px-5 text-[17px] outline-none focus:border-accent"
          />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={() => setMode("buttons")}
              className="h-12 rounded-full px-5 text-[15px] font-bold text-muted-foreground"
            >
              Atrás
            </button>
            <button
              type="button"
              disabled={busy || !/^\S+@\S+\.\S+$/.test(mail.trim())}
              onClick={() =>
                void run(async () => {
                  await sendCode(mail);
                  setMode("code");
                  toast.success("Te mandé un código por correo");
                }, "No pude enviar el código.")
              }
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Enviar código
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[14px] text-muted-foreground">
            Escribe el código que llegó a <b>{mail}</b>.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Código"
            aria-label="Código del correo"
            className="h-14 w-full rounded-full border-2 border-border bg-card px-5 text-center text-[22px] font-bold tracking-[0.3em] outline-none focus:border-accent"
          />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={() => {
                setCode("");
                setMode("email");
              }}
              className="h-12 rounded-full px-5 text-[15px] font-bold text-muted-foreground"
            >
              Atrás
            </button>
            <button
              type="button"
              disabled={busy || code.length < 6}
              onClick={() =>
                void run(async () => {
                  await verifyCode(mail, code);
                  setCode("");
                }, "Ese código no sirve.")
              }
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
