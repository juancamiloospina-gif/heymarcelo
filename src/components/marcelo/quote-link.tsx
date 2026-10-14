import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, FileText, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { flyerPdf } from "@/lib/flyer";
import { buildPublicProfile, shareUrl } from "@/lib/public-profile";

/**
 * "Consigue clientes": a QR and link for the truck or flyers, plus a printable flyer with the
 * services and area. Works without any server. What the QR opens comes from `shareUrl()`, so
 * it will point to the public profile page once there is a backend.
 */
export function QuoteLinkCard() {
  const { state, setProfile } = useMarcelo();
  const profile = useMemo(() => buildPublicProfile(state), [state]);
  const link = shareUrl(profile, "qr");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!link) return;
    void QRCode.toDataURL(link, {
      margin: 1,
      width: 480,
      color: { dark: "#2b2d35", light: "#ffffff" },
    }).then(setQr);
  }, [link]);

  if (!link) {
    return (
      <Card className="text-[15px] text-muted-foreground">
        Conecta tu WhatsApp Business para crear tu enlace, tu QR y tu volante.
      </Card>
    );
  }

  const makeFlyer = async () => {
    setBusy(true);
    try {
      const doc = await flyerPdf(profile);
      doc.save("marcelo-volante.pdf");
    } catch {
      toast.error("No pude crear el volante");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 text-[16px] font-semibold">
        <QrCode className="size-5 text-accent" /> Tu enlace “Pide tu cotización”
      </p>
      <p className="text-[14px] text-muted-foreground">
        Ponlo en tu camioneta o volantes. Al escanearlo, el cliente te escribe por WhatsApp.
      </p>
      {qr ? (
        <img
          src={qr}
          alt="Código QR para pedir cotización"
          className="mx-auto size-44 rounded-xl border"
        />
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast.success("Enlace copiado");
            } catch {
              toast.error("No pude copiarlo");
            }
          }}
        >
          <Copy className="size-4" /> Copiar enlace
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const a = document.createElement("a");
            a.href = qr;
            a.download = "marcelo-qr-cotizacion.png";
            a.click();
          }}
        >
          <Download className="size-4" /> Bajar QR
        </Button>
      </div>

      <div className="space-y-3 border-t pt-3">
        <p className="text-[16px] font-semibold">Tu volante para imprimir</p>
        <p className="text-[14px] text-muted-foreground">
          Sale en inglés, con tu QR, tus servicios y tu zona. Lo puedes pegar en la camioneta o
          dejarlo en las puertas.
        </p>
        <Field
          label="¿Dónde trabajas? (ciudades o códigos postales)"
          placeholder="Pasadena, Altadena, 91101-91107"
          value={state.profile.serviceArea ?? ""}
          onChange={(e) => setProfile({ serviceArea: e.target.value })}
        />
        <label className="flex min-h-12 items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={state.profile.showPhoneOnFlyer ?? false}
            onChange={(e) => setProfile({ showPhoneOnFlyer: e.target.checked })}
          />
          Poner mi teléfono en el volante
        </label>
        <Button className="w-full" disabled={busy} onClick={() => void makeFlyer()}>
          <FileText className="size-4" /> {busy ? "Creando…" : "Bajar volante en PDF"}
        </Button>
      </div>
    </Card>
  );
}
