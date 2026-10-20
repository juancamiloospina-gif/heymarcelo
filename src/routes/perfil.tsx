import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Camera,
  ChevronRight,
  MapPin,
  Pencil,
  Star,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { BackButton, Button, Card, Screen, Sheet } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { useAIStatus } from "@/lib/ai/config";
import { cloudEnabled, deleteAccount, uploadProfilePhoto, useCloudSession } from "@/lib/cloud";
import { compressImage, photoErrorText } from "@/lib/image";
import {
  loadPlaces,
  matchPlace,
  placeValue,
  searchPlaces,
  stateName,
  type Place,
} from "@/lib/places";
import { cn } from "@/lib/utils";
import character from "@/assets/marcelo-character.png";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Marcelo" },
      { name: "description", content: "Tu foto, tus datos, tu plan y tu cuenta." },
    ],
  }),
  component: Perfil,
});

/** "Mi perfil": its own screen (photo, name, trade, city, plan, delete account). */
function Perfil() {
  const navigate = useNavigate();
  const { state, setProfile, reset } = useMarcelo();
  const session = useCloudSession();
  const ai = useAIStatus();
  const { profile } = state;
  const [form, setForm] = useState({
    name: profile.name,
    trade: profile.trade,
    city: profile.city,
  });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // City check, same list as the onboarding; loaded when the city field is touched.
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [placesFailed, setPlacesFailed] = useState(false);
  const [unlisted, setUnlisted] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  useEffect(() => {
    if (!cityTouched || places) return;
    loadPlaces()
      .then(setPlaces)
      .catch(() => setPlacesFailed(true));
  }, [cityTouched, places]);
  const cityChanged = form.city.trim() !== profile.city.trim();
  const matched = useMemo(
    () => (places && cityChanged ? matchPlace(places, form.city) : null),
    [places, cityChanged, form.city],
  );
  const suggestions = useMemo(
    () => (places && cityChanged && !matched ? searchPlaces(places, form.city) : []),
    [places, cityChanged, matched, form.city],
  );
  const cityOk = !cityChanged || Boolean(matched) || unlisted || placesFailed;

  const dirty =
    form.name.trim() !== profile.name ||
    form.trade.trim() !== profile.trade ||
    form.city.trim() !== profile.city;
  const canSave = dirty && form.name.trim().length > 0 && form.city.trim().length > 0 && cityOk;

  const save = () => {
    setProfile({
      name: form.name.trim(),
      trade: form.trade.trim(),
      city: matched ? placeValue(matched) : form.city.trim(),
    });
    setUnlisted(false);
    setCityTouched(false);
    toast.success("Perfil guardado");
  };

  const pickPhoto = () => {
    if (!cloudEnabled) return void toast.error("La nube no está conectada en esta versión.");
    if (!session)
      return void toast.error("Para guardar tu foto, primero entra con tu correo en Mi página.");
    fileRef.current?.click();
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadProfilePhoto(await compressImage(file));
      setProfile({ photoUrl: url });
      toast.success("Foto guardada. Publica tu página para que se vea ahí.");
    } catch (e) {
      toast.error(photoErrorText(e), { duration: 8000 });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Screen>
      <div className="mb-3 flex items-center gap-3">
        <BackButton onClick={() => navigate({ to: "/configuracion" })} label="Configuración" />
        <h1 className="-mt-3 text-[26px] font-extrabold tracking-tight">Mi perfil</h1>
      </div>

      <Card className="flex items-center gap-4 rounded-[1.5rem] p-4">
        <div className="relative shrink-0">
          <span className="flex size-[104px] items-center justify-center overflow-hidden rounded-full bg-brand-soft">
            <img
              src={profile.photoUrl || character}
              alt=""
              className={cn(
                "object-cover",
                profile.photoUrl ? "size-full object-top" : "size-[96px] object-contain",
              )}
            />
          </span>
          <button
            onClick={pickPhoto}
            disabled={busy}
            aria-label="Cambiar foto"
            className="absolute -bottom-1 -right-1 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card disabled:opacity-60"
          >
            <Camera className="size-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void onPhoto(e.target.files?.[0])}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-[26px] font-extrabold leading-tight">
            {profile.name || "Tu nombre"}
          </p>
          <button onClick={pickPhoto} className="mt-1 text-[16px] font-bold text-sky">
            {busy ? "Subiendo…" : "Cambiar foto"}
          </button>
        </div>
      </Card>

      <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em]">Tus datos</h2>
      <Card className="divide-y divide-border overflow-hidden rounded-[1.25rem] p-0">
        <Row icon={User} label="Nombre">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
            className={inputCls}
          />
        </Row>
        <Row icon={Briefcase} label="Trabajo">
          <input
            value={form.trade}
            onChange={(e) => setForm({ ...form, trade: e.target.value })}
            className={inputCls}
          />
        </Row>
        <Row icon={MapPin} label="Ciudad">
          <input
            value={form.city}
            onFocus={() => setCityTouched(true)}
            onChange={(e) => {
              setCityTouched(true);
              setUnlisted(false);
              setForm({ ...form, city: e.target.value });
            }}
            className={inputCls}
          />
        </Row>
      </Card>

      {cityChanged ? (
        <div className="mt-2 space-y-2">
          {matched ? (
            <p className="rounded-2xl bg-success/10 px-4 py-2.5 text-[15px] font-semibold text-success">
              ✓ {matched.name}, {stateName(matched.st)}
            </p>
          ) : (
            <>
              {suggestions.map((p) => (
                <button
                  key={`${p.name}-${p.st}`}
                  onClick={() => setForm({ ...form, city: placeValue(p) })}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-card px-4 text-left text-[16px] font-bold shadow-[var(--shadow-card)]"
                >
                  <MapPin className="size-5 text-sky" />
                  {p.name}, {stateName(p.st)}
                </button>
              ))}
              {places && form.city.trim().length >= 3 && suggestions.length === 0 && !unlisted ? (
                <div className="rounded-2xl bg-peach p-4 text-[15px]">
                  <p className="font-semibold">No encontré esa ciudad en Estados Unidos.</p>
                  <button
                    onClick={() => setUnlisted(true)}
                    className="mt-2 h-10 rounded-full border border-accent/40 bg-card px-4 text-[14px] font-bold text-accent"
                  >
                    Usar tal como la escribí
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <h2 className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.1em]">Suscripción</h2>
      <Card className="flex items-center gap-3 rounded-[1.25rem] border-sky/15 bg-brand-soft p-3.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-peach text-accent">
          <Star className="size-7 fill-accent" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-extrabold">Plan Marcelo</span>
          <span className="block text-[14px] leading-snug text-muted-foreground">
            {ai.own
              ? "Sin límite · usando tu propia IA"
              : `${ai.left} ${ai.left === 1 ? "conversación disponible" : "conversaciones disponibles"}`}
          </span>
        </span>
        <button
          onClick={() => navigate({ to: "/ia" })}
          className="h-11 shrink-0 rounded-full border-2 border-sky bg-card px-4 text-[15px] font-bold text-sky"
        >
          Ver plan
        </button>
      </Card>

      <Button
        className="mt-5 h-14 w-full rounded-full text-[17px]"
        disabled={!canSave}
        onClick={save}
      >
        Guardar cambios
      </Button>

      <Card
        onClick={() => setDeleting(true)}
        className="mt-5 flex items-center gap-3 rounded-[1.25rem] border-destructive/30 p-3.5"
      >
        <Trash2 className="size-7 shrink-0 text-destructive" strokeWidth={1.6} />
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-extrabold text-destructive">Eliminar cuenta</span>
          <span className="block text-[14px] text-muted-foreground">
            Borra tus datos de este teléfono
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-destructive/70" />
      </Card>

      {deleting ? (
        <DeleteSheet
          signedIn={Boolean(session)}
          onClose={() => setDeleting(false)}
          onWipe={() => {
            reset();
            toast.success("Marcelo empezó de nuevo");
            navigate({ to: "/" });
          }}
          onCloud={async () => {
            await deleteAccount();
            setProfile({ publicSlug: undefined });
            toast.success("Cuenta en la nube borrada");
          }}
        />
      ) : null}
    </Screen>
  );
}

const inputCls =
  "mt-0.5 h-8 w-full min-w-0 bg-transparent text-[18px] font-semibold text-foreground outline-none";

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-[76px] cursor-text items-center gap-4 px-4 py-2.5">
      <Icon className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.6} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-muted-foreground">{label}</span>
        {children}
      </span>
      <Pencil className="size-5 shrink-0 text-muted-foreground/70" />
    </label>
  );
}

/** Two separate things, each with its own confirmation: this phone's data and the cloud account. */
function DeleteSheet({
  signedIn,
  onClose,
  onWipe,
  onCloud,
}: {
  signedIn: boolean;
  onClose: () => void;
  onWipe: () => void;
  onCloud: () => Promise<void>;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [cloudStep, setCloudStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      title="Eliminar cuenta"
      icon={<AlertTriangle className="size-5 text-destructive" />}
      onClose={onClose}
    >
      <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
        Elige qué quieres borrar. Cada cosa pide confirmación y no se puede deshacer.
      </p>

      <div className="space-y-2 rounded-2xl border border-destructive/25 p-3">
        <p className="text-[16px] font-bold">Datos de este teléfono</p>
        <p className="text-[14px] text-muted-foreground">
          Tus clientes, trabajos, cobros y gastos. Descarga una copia antes en Configuración › Datos
          y privacidad.
        </p>
        {step === 0 ? (
          <Button variant="danger" className="w-full" onClick={() => setStep(1)}>
            Borrar mis datos
          </Button>
        ) : (
          <div className="space-y-2 rounded-2xl bg-destructive/5 p-3">
            <p className="text-[15px] font-semibold text-destructive">
              {step === 1
                ? "Se borran todos tus clientes, trabajos y dinero. ¿Seguro?"
                : "Última confirmación: esto no se puede deshacer."}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setStep(0)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => (step === 1 ? setStep(2) : onWipe())}>
                {step === 1 ? "Sí, borrar" : "Borrar todo"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {signedIn ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-destructive/25 p-3">
          <p className="text-[16px] font-bold">Mi cuenta en la nube</p>
          <p className="text-[14px] text-muted-foreground">
            Tu página pública y las solicitudes que te llegaron. Los QR y volantes impresos dejan de
            funcionar. Lo que está en tu teléfono no se toca.
          </p>
          {cloudStep === 0 ? (
            <Button variant="danger" className="w-full" onClick={() => setCloudStep(1)}>
              Borrar mi cuenta en la nube
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setCloudStep(0)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onCloud();
                    onClose();
                  } catch {
                    toast.error("No pude borrar la cuenta. Intenta de nuevo.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Sí, borrar
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
