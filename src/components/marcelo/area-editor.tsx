import { useEffect, useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AreaMap } from "./area-map";
import { Button, Field } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import {
  isZip,
  loadZipTable,
  MAX_ZIPS,
  pointsFor,
  RADIUS_OPTIONS,
  zipsWithin,
} from "@/lib/service-area";

/**
 * The worker's work perimeter: a central ZIP + a radius gives the list of ZIP codes covered, and
 * the list can be adjusted one by one. "Miami" is too big to mean anything; this says exactly where.
 */
export function AreaEditor() {
  const { state, setProfile } = useMarcelo();
  const { profile } = state;
  const zips = profile.areaZips ?? [];
  const [center, setCenter] = useState(profile.areaCenterZip ?? "");
  const [radius, setRadius] = useState<number>(profile.areaRadiusMi || 10);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // An area saved before maps existed has ZIP codes but no positions: fill them in once.
  const missingPoints = zips.length > 0 && !profile.areaPoints?.length;
  useEffect(() => {
    if (!missingPoints) return;
    let stop = false;
    void loadZipTable()
      .then((table) => {
        if (stop) return;
        const here = profile.areaCenterZip ? table.get(profile.areaCenterZip) : undefined;
        setProfile({
          areaCenter: here ? [here[0], here[1]] : undefined,
          areaPoints: pointsFor(table, zips),
        });
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when positions are missing
  }, [missingPoints]);

  const calculate = async () => {
    setError("");
    if (!isZip(center)) return setError("Escribe un código postal de 5 números.");
    setBusy(true);
    try {
      const table = await loadZipTable();
      const found = zipsWithin(table, center, radius);
      if (!found) return setError("No encuentro ese código postal. Revisa que sea de EE. UU.");
      const here = table.get(center);
      setProfile({
        areaCenterZip: center,
        areaRadiusMi: radius,
        areaZips: found.zips,
        areaCenter: here ? [here[0], here[1]] : undefined,
        areaPoints: pointsFor(table, found.zips),
      });
      if (found.truncated) {
        toast.message(
          `Tu zona tiene más de ${MAX_ZIPS} códigos. Guardé los ${MAX_ZIPS} más cercanos: elige un radio menor.`,
        );
      }
    } catch {
      setError("No pude cargar la lista de códigos postales. Revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  };

  const addZip = async () => {
    setError("");
    if (!isZip(extra)) return setError("Escribe un código postal de 5 números.");
    if (zips.includes(extra)) return setExtra("");
    if (zips.length >= MAX_ZIPS) return setError(`Máximo ${MAX_ZIPS} códigos postales.`);
    try {
      const point = pointsFor(await loadZipTable(), [extra]);
      if (!point.length)
        return setError("No encuentro ese código postal. Revisa que sea de EE. UU.");
      setProfile({
        areaZips: [...zips, extra],
        areaPoints: [...(profile.areaPoints ?? []), ...point],
      });
      setExtra("");
    } catch {
      setError("No pude cargar la lista de códigos postales. Revisa tu conexión.");
    }
  };

  const removeZip = (z: string) =>
    setProfile({
      areaZips: zips.filter((x) => x !== z),
      areaPoints: (profile.areaPoints ?? []).filter(([zip]) => zip !== z),
    });

  const clear = () => {
    setProfile({
      areaCenterZip: undefined,
      areaRadiusMi: undefined,
      areaZips: undefined,
      areaCenter: undefined,
      areaPoints: undefined,
    });
    setCenter("");
    setError("");
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-[16px] font-semibold">
          <MapPin className="size-5 text-accent" /> Tu zona de trabajo
        </p>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Di desde dónde sales y hasta qué distancia llegas. Tus clientes podrán comprobar si cubres
          su zona.
        </p>
      </div>

      <Field
        label="Código postal desde donde sales"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        placeholder="91101"
        value={center}
        onChange={(e) => setCenter(e.target.value.replace(/\D/g, ""))}
      />

      <div>
        <p className="mb-1.5 text-[14px] font-medium text-muted-foreground">Hasta qué distancia</p>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={radius === r}
              onClick={() => setRadius(r)}
              className={`min-h-12 rounded-full border px-4 text-[15px] font-medium ${
                radius === r
                  ? "border-accent bg-accent/10 text-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {r} millas
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full" disabled={busy || !isZip(center)} onClick={() => void calculate()}>
        {busy ? "Calculando…" : zips.length ? "Volver a calcular mi zona" : "Calcular mi zona"}
      </Button>
      {error ? <p className="text-[14px] font-medium text-destructive">{error}</p> : null}

      {zips.length ? (
        <div className="space-y-2">
          <p className="text-[15px] font-semibold">
            {zips.length} códigos postales
            {profile.areaCenterZip && profile.areaRadiusMi
              ? ` a ${profile.areaRadiusMi} millas de ${profile.areaCenterZip}`
              : ""}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Quita los que no cubres o agrega otros. Es aproximado: cuenta cada código por su punto
            central.
          </p>
          <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {zips.map((z) => (
              <li key={z}>
                <button
                  type="button"
                  aria-label={`Quitar ${z}`}
                  onClick={() => removeZip(z)}
                  className="flex min-h-10 items-center gap-1 rounded-full border bg-card pl-3 pr-2 text-[14px]"
                >
                  {z} <X className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          {profile.areaPoints?.length ? (
            <AreaMap
              center={profile.areaCenter ?? null}
              points={profile.areaPoints}
              radiusMi={profile.areaRadiusMi ?? 0}
              lang="es"
            />
          ) : null}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label="Agregar un código postal"
                inputMode="numeric"
                maxLength={5}
                value={extra}
                onChange={(e) => setExtra(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button variant="secondary" disabled={!isZip(extra)} onClick={() => void addZip()}>
              <Plus className="size-4" /> Agregar
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={clear}>
            Quitar mi zona
          </Button>
        </div>
      ) : null}

      <Field
        label="Notas de tu zona (opcional)"
        placeholder="No cubro el norte de Altadena"
        maxLength={200}
        value={profile.serviceArea ?? ""}
        onChange={(e) => setProfile({ serviceArea: e.target.value })}
      />
    </div>
  );
}
