import { useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field } from "./kit";
import { TRAIT_KEYS, type TraitKey } from "@/lib/marcelo-data";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  cloudEnabled,
  publishKey,
  removeProfilePhoto,
  uploadProfilePhoto,
  useCloudSession,
} from "@/lib/cloud";
import { compressImage } from "@/lib/image";
import { T } from "@/lib/public-i18n";
import { buildPublicProfile } from "@/lib/public-profile";
import { publishNotice, publishPage } from "@/lib/publish";
import { viewFromPublic } from "@/lib/public-view";
import { PublicProfileView } from "./public-profile-view";

const BIO_MAX = 600;
const TAGLINE_MAX = 60;

/** What the user writes about themselves: photo, tagline, "about me", traits and prices. */
export function PageEditor() {
  const { state, setProfile } = useMarcelo();
  const session = useCloudSession();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { profile } = state;
  const traits = profile.traits ?? [];
  const signedIn = Boolean(session);
  const pub = useMemo(() => buildPublicProfile(state), [state]);
  const slug = profile.publicSlug;
  // Edits live on the phone until they are published: tell the user when the page is behind.
  const dirty = Boolean(slug) && profile.publishedKey !== publishKey(pub, slug ?? "");

  const publishChanges = async () => {
    if (!slug) return;
    setBusy(true);
    try {
      const { patch, status } = await publishPage(state, slug);
      setProfile(patch);
      const n = publishNotice(status, false);
      if (n.ok) toast.success(n.text);
      else toast.warning(n.text);
    } catch {
      toast.error("No pude publicar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const toggleTrait = (k: TraitKey) => {
    if (traits.includes(k)) return setProfile({ traits: traits.filter((t) => t !== k) });
    if (traits.length >= 3) return toast.message("Elige máximo 3");
    setProfile({ traits: [...traits, k] });
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadProfilePhoto(await compressImage(file));
      setProfile({ photoUrl: url });
      toast.success("Foto guardada. Publica tu página para que se vea.");
    } catch {
      toast.error("No pude subir la foto. Intenta con otra.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    try {
      await removeProfilePhoto();
      setProfile({ photoUrl: undefined });
    } catch {
      toast.error("No pude quitar la foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        {profile.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt="Tu foto"
            className="size-24 shrink-0 rounded-full border object-cover object-top"
          />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted text-[34px] font-bold text-muted-foreground">
            {profile.name.trim().charAt(0).toUpperCase() || "M"}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[15px] text-muted-foreground">
            Una foto tuya, sonriendo y con tu ropa de trabajo, genera confianza.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !cloudEnabled || !signedIn}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-4" /> {profile.photoUrl ? "Cambiar" : "Subir foto"}
            </Button>
            {profile.photoUrl ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void removePhoto()}>
                <Trash2 className="size-4" /> Quitar
              </Button>
            ) : null}
          </div>
          {!signedIn ? (
            <p className="text-[13px] text-muted-foreground">
              Para subir la foto, primero entra con tu correo (más abajo).
            </p>
          ) : null}
        </div>
      </div>

      <Field
        label="Tu frase (opcional)"
        placeholder="Tu jardín, mi compromiso"
        maxLength={TAGLINE_MAX}
        value={profile.tagline ?? ""}
        onChange={(e) => setProfile({ tagline: e.target.value })}
      />

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-muted-foreground">Sobre ti</span>
        <textarea
          rows={5}
          maxLength={BIO_MAX}
          placeholder="Hola, soy Carlos. Llevo 8 años en jardinería. Soy puntual y trato cada casa como si fuera la mía."
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-[16px] outline-none placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/25"
          value={profile.bio ?? ""}
          onChange={(e) => setProfile({ bio: e.target.value })}
        />
        <span className="mt-1 block text-[13px] text-muted-foreground">
          Escribe como si hablaras con un cliente. {(profile.bio ?? "").length}/{BIO_MAX}
        </span>
      </label>
      {pub.bioEn ? (
        <div className="rounded-2xl bg-muted px-4 py-3">
          <p className="text-[13px] font-medium text-muted-foreground">
            Así lo leen tus clientes, en inglés
          </p>
          <p className="mt-1 whitespace-pre-line text-[15px]">{pub.bioEn}</p>
        </div>
      ) : (profile.bio ?? "").trim() ? (
        <p className="text-[13px] text-muted-foreground">Se traduce al inglés cuando publicas.</p>
      ) : null}

      <div>
        <p className="mb-1.5 text-[14px] font-medium text-muted-foreground">
          Lo que te describe (máximo 3)
        </p>
        <div className="flex flex-wrap gap-2">
          {TRAIT_KEYS.map((k) => {
            const on = traits.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTrait(k)}
                className={`min-h-12 rounded-full border px-4 text-[15px] font-medium ${
                  on
                    ? "border-accent bg-accent/10 text-foreground"
                    : "bg-card text-muted-foreground"
                }`}
              >
                {T.es.traits[k]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex min-h-12 items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          className="size-5 accent-accent"
          checked={profile.showPrices ?? true}
          onChange={(e) => setProfile({ showPrices: e.target.checked })}
        />
        Mostrar “Desde $” en cada servicio
      </label>
      <p className="text-[13px] text-muted-foreground">
        Tus servicios y precios salen de la pantalla Servicios y precios. Si cambias algo allá,
        vuelve a publicar.
      </p>

      {!slug ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-[15px] text-muted-foreground">
          Cuando termines, entra con tu correo y publica tu página (más abajo).
        </p>
      ) : dirty ? (
        <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent/10 p-3">
          <p className="text-[15px] font-semibold">Tienes cambios sin publicar</p>
          <p className="text-[14px] text-muted-foreground">
            Tus clientes todavía ven la versión anterior de tu página.
          </p>
          <Button
            className="w-full"
            disabled={busy || !signedIn}
            onClick={() => void publishChanges()}
          >
            {busy ? "Publicando…" : "Publicar cambios"}
          </Button>
          {!signedIn ? (
            <p className="text-[13px] text-muted-foreground">
              Primero entra con tu correo (más abajo).
            </p>
          ) : null}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[15px] font-medium text-muted-foreground">
          <CheckCircle2 className="size-5 text-accent" /> Tu página está al día
        </p>
      )}
    </Card>
  );
}

/** The page as the client will see it, built from the data on the phone. */
export function PagePreview() {
  const { state } = useMarcelo();
  const view = useMemo(() => viewFromPublic(buildPublicProfile(state)), [state]);
  return (
    <div className="pointer-events-none max-h-[640px] overflow-y-auto rounded-3xl border">
      <PublicProfileView profile={view} lang="en" />
    </div>
  );
}
