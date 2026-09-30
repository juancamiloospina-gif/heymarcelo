import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "./kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { digits } from "@/lib/marcelo-data";

/**
 * "Pide tu cotización": a WhatsApp link (and QR for the truck or flyers) that opens a chat
 * with the user's business number and a ready message. Works without any server.
 */
export function QuoteLinkCard() {
  const { state } = useMarcelo();
  const number = digits(state.connections.whatsapp.number ?? "");
  const text = `Hi ${state.profile.name.split(" ")[0] || ""}! I'd like a quote for ${state.profile.trade ? state.profile.trade.toLowerCase() : "yard work"}.`;
  const link = number ? `https://wa.me/1${number}?text=${encodeURIComponent(text)}` : "";
  const [qr, setQr] = useState("");

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
        Conecta tu WhatsApp Business para crear tu enlace y QR de cotización.
      </Card>
    );
  }

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
    </Card>
  );
}
