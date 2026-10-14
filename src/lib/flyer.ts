/**
 * Printable flyer (letter size, English, for clients): business, services, area and a QR.
 * Built only from `PublicProfile`, so it does not change when the backend arrives.
 */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatPhone, shareUrl, type PublicProfile } from "./public-profile";

const safe = (s: string) => s.replace(/[−–—]/g, "-");

export async function flyerPdf(p: PublicProfile): Promise<jsPDF> {
  const url = shareUrl(p, "flyer");
  // 1200 px so the QR stays sharp when printed (about 3.5 in).
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 1200,
    color: { dark: "#2b2d35", light: "#ffffff" },
  });
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const cx = 306;

  doc.setFont("helvetica", "bold").setFontSize(30).setTextColor(43, 45, 53);
  doc.text(safe(p.businessName || "Your business"), cx, 90, { align: "center", maxWidth: 500 });
  doc.setFont("helvetica", "normal").setFontSize(16).setTextColor(100, 100, 100);
  const sub = [p.tradeEn, p.city].filter(Boolean).join(" · ");
  if (sub) doc.text(safe(sub), cx, 118, { align: "center" });

  doc.setFont("helvetica", "bold").setFontSize(24).setTextColor(43, 45, 53);
  doc.text("Need a free quote?", cx, 190, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(14).setTextColor(100, 100, 100);
  doc.text("Scan with your phone camera and send me a message.", cx, 212, { align: "center" });

  doc.addImage(qr, "PNG", cx - 126, 236, 252, 252);

  let y = 540;
  doc.setTextColor(43, 45, 53);
  if (p.services.length) {
    doc.setFont("helvetica", "bold").setFontSize(15).text("Services", cx, y, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(14);
    y += 24;
    doc.text(safe(p.services.join("  ·  ")), cx, y, { align: "center", maxWidth: 480 });
    y += 40;
  }
  if (p.serviceArea) {
    doc
      .setFont("helvetica", "bold")
      .setFontSize(15)
      .text("Service area", cx, y, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(14);
    y += 24;
    doc.text(safe(p.serviceArea), cx, y, { align: "center", maxWidth: 480 });
    y += 40;
  }
  if (p.showPhone && p.phone) {
    doc.setFont("helvetica", "bold").setFontSize(20).text(formatPhone(p.phone), cx, y, {
      align: "center",
    });
  }
  return doc;
}
