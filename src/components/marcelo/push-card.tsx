import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "./kit";
import { cloudEnabled, useCloudSession } from "@/lib/cloud";
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from "@/lib/push";

/** "Avisos": a notification on this phone when someone asks for a quote, even with the app closed. */
export function PushCard() {
  const session = useCloudSession();
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => void pushState().then(setState), []);
  useEffect(refresh, [refresh]);

  if (!cloudEnabled || !session) return null;

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const m = (e as Error).message;
      toast.error(m === "permission_denied" ? "No diste permiso para los avisos." : fail);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 text-[16px] font-semibold">
        <Bell className="size-5 text-accent" /> Avisos de solicitudes
      </p>
      <p className="text-[14px] text-muted-foreground">
        Recibe un aviso en este teléfono cuando alguien te pida una cotización, aunque la app esté
        cerrada.
      </p>

      {state === "unsupported" ? (
        <p className="text-[14px] text-muted-foreground">
          Este navegador no permite avisos. Prueba con Chrome o Safari actualizados.
        </p>
      ) : null}

      {state === "needs_install" ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-[14px]">
          En iPhone, primero agrega Marcelo a tu pantalla de inicio: toca el botón Compartir y luego
          “Agregar a pantalla de inicio”. Abre Marcelo desde ahí y vuelve a esta pantalla.
        </p>
      ) : null}

      {state === "denied" ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-[14px]">
          Los avisos están bloqueados para Marcelo. Actívalos en los ajustes del teléfono o del
          navegador y vuelve aquí.
        </p>
      ) : null}

      {state === "off" ? (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await enablePush();
              toast.success("Avisos activados en este teléfono");
            }, "No pude activar los avisos. Intenta de nuevo.")
          }
        >
          <Bell className="size-4" /> {busy ? "Activando…" : "Activar avisos"}
        </Button>
      ) : null}

      {state === "on" ? (
        <div className="space-y-2">
          <p className="text-[15px] font-medium">✓ Avisos activados en este teléfono</p>
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await sendTestPush();
                if (r.sent > 0)
                  toast.success("Te mandé un aviso de prueba. Debe llegar en segundos.");
                else
                  toast.warning(
                    "No pude entregar el aviso. Desactiva y vuelve a activar los avisos.",
                  );
              }, "No pude mandar el aviso de prueba.")
            }
          >
            {busy ? "Enviando…" : "Mandarme un aviso de prueba"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => void run(disablePush, "No pude desactivar los avisos.")}
          >
            <BellOff className="size-4" /> Desactivar en este teléfono
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
