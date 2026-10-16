import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  cloudEnabled,
  isValidSlug,
  publishProfile,
  sendCode,
  signOut,
  slugify,
  useCloudSession,
  verifyCode,
} from "@/lib/cloud";
import { buildPublicProfile } from "@/lib/public-profile";

/**
 * "Tu página pública": sign in with an email code, pick an address and publish. The page
 * (`/p/<slug>`) is what the QR and the flyer open once the public domain is set.
 */
export function PublicPageCard() {
  const { state, setProfile } = useMarcelo();
  const session = useCloudSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState(state.profile.publicSlug ?? "");
  const profile = useMemo(() => buildPublicProfile(state), [state]);

  useEffect(() => {
    if (!slug && !state.profile.publicSlug) setSlug(slugify(state.profile.name));
  }, [state.profile.name, state.profile.publicSlug, slug]);

  if (!cloudEnabled || session === undefined) return null;

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const m = (e as Error).message;
      toast.error(m === "slug_taken" ? "Ese nombre ya está en uso. Prueba otro." : fail);
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <Card className="space-y-3">
        <p className="flex items-center gap-2 text-[16px] font-semibold">
          <Globe className="size-5 text-accent" /> Tu página pública
        </p>
        <p className="text-[14px] text-muted-foreground">
          Una página con tus servicios y tu zona, donde tus clientes piden cotización. Entra con tu
          correo para crearla.
        </p>
        {!sent ? (
          <>
            <Field
              label="Tu correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={busy || !email.includes("@")}
              onClick={() =>
                void run(async () => {
                  await sendCode(email);
                  setSent(true);
                }, "No pude enviar el código. Intenta en unos minutos.")
              }
            >
              Enviarme un código
            </Button>
          </>
        ) : (
          <>
            <Field
              label={`Código que llegó a ${email}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={busy || code.trim().length < 6}
              onClick={() =>
                void run(() => verifyCode(email, code), "Ese código no sirve. Revisa o pide otro.")
              }
            >
              Entrar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
              Cambiar correo
            </Button>
          </>
        )}
      </Card>
    );
  }

  const published = Boolean(state.profile.publicSlug);
  const valid = isValidSlug(slug);
  const pageUrl = `${typeof window === "undefined" ? "" : window.location.origin}/p/${state.profile.publicSlug ?? slug}`;

  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 text-[16px] font-semibold">
        <Globe className="size-5 text-accent" /> Tu página pública
      </p>
      <p className="text-[14px] text-muted-foreground">
        Sesión de {session.user.email}. Tus clientes ven tu nombre, servicios y zona, sin tu
        dirección.
      </p>
      <Field
        label="Dirección de tu página"
        value={slug}
        disabled={published}
        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
      />
      <p className="text-[13px] text-muted-foreground">
        {published
          ? "Esta dirección ya está en tus QR: no se cambia."
          : "Mínimo 3 letras o números. Después de publicar ya no se cambia."}
      </p>
      <Button
        className="w-full"
        disabled={busy || !valid || !state.profile.name.trim()}
        onClick={() =>
          void run(async () => {
            await publishProfile(profile, slug);
            setProfile({ publicSlug: slug });
            toast.success(published ? "Página actualizada" : "Página publicada");
          }, "No pude publicar. Intenta de nuevo.")
        }
      >
        {published ? "Actualizar mi página" : "Publicar mi página"}
      </Button>
      {published ? (
        <a
          href={pageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[15px] font-semibold"
        >
          <ExternalLink className="size-4" /> Ver mi página
        </a>
      ) : null}
      <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </Card>
  );
}
