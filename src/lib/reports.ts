/**
 * Documents generated on the phone: invoices (in English, for clients) and the accountant
 * package (one-page PDF + CSV + ZIP with receipt photos). Shared with the phone's own share
 * sheet (WhatsApp, email…) when it supports files; downloaded otherwise.
 */
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import {
  paymentMethodLabel,
  paymentMethods,
  type ExpenseCategory,
  type Job,
  type MarceloState,
} from "./marcelo-data";

/** How accountants usually want expenses grouped (Schedule C–style buckets, no tax advice). */
export const accountantGroup: Record<ExpenseCategory, string> = {
  Publicidad: "Publicidad",
  Gasolina: "Vehículo",
  Vehículo: "Vehículo",
  Materiales: "Suministros",
  Herramientas: "Suministros",
  Seguro: "Seguro",
  Teléfono: "Teléfono y servicios",
  Ayudantes: "Ayudantes (mano de obra)",
  Otros: "Otros",
};

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safe = (s: string) => s.replace(/[\u2212\u2013\u2014]/g, "-");

async function share(files: File[], title: string): Promise<boolean> {
  try {
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, title });
      return true;
    }
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return true; // user closed the share sheet
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
  }
  return false;
}

export function invoicePdf(state: MarceloState, job: Job) {
  const client = state.clients.find((c) => c.id === job.clientId);
  const service = state.services.find((s) => s.id === job.serviceId || s.name === job.service);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const number = `INV-${job.date.replace(/-/g, "")}-${job.id.slice(0, 4).toUpperCase()}`;
  let y = 64;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(22)
    .text(safe(state.profile.name || "Invoice"), 56, y);
  doc.setFont("helvetica", "normal").setFontSize(11);
  y += 18;
  doc.text(safe([state.profile.trade, state.profile.city].filter(Boolean).join(" · ")), 56, y);
  doc.setFont("helvetica", "bold").setFontSize(16).text("INVOICE", 556, 64, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(number, 556, 82, { align: "right" });
  doc.text(`Date: ${new Date(`${job.date}T12:00:00`).toLocaleDateString("en-US")}`, 556, 98, {
    align: "right",
  });

  y = 150;
  doc.setFont("helvetica", "bold").text("Bill to", 56, y);
  doc.setFont("helvetica", "normal");
  y += 16;
  doc.text(safe(client?.name ?? "Client"), 56, y);
  if (job.address || client?.address) doc.text(safe(job.address || client!.address), 56, (y += 14));

  y += 40;
  doc.setDrawColor(220).line(56, y, 556, y);
  y += 20;
  doc
    .setFont("helvetica", "bold")
    .text("Service", 56, y)
    .text("Amount", 556, y, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal").text(safe(service?.nameEn ?? job.service), 56, y);
  doc.text(usd(job.price), 556, y, { align: "right" });
  y += 20;
  doc.line(56, y, 556, y);
  y += 26;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(14)
    .text("Total due", 56, y)
    .text(usd(job.price), 556, y, { align: "right" });

  if (state.settings.paymentInstructions) {
    y += 44;
    doc.setFontSize(11).text("How to pay", 56, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(safe(state.settings.paymentInstructions), 500), 56, y + 16);
  }
  doc.setFontSize(11).setFont("helvetica", "normal").text("Thank you for your business!", 56, 720);
  return { doc, name: `${number}.pdf` };
}

export async function shareInvoice(state: MarceloState, job: Job) {
  const { doc, name } = invoicePdf(state, job);
  return share([new File([doc.output("blob")], name, { type: "application/pdf" })], "Invoice");
}

export function yearNumbers(state: MarceloState, year: string) {
  const payments = state.payments.filter((p) => p.date.startsWith(year));
  const expenses = state.expenses.filter((e) => e.date.startsWith(year));
  const miles = state.miles.filter((m) => m.date.startsWith(year)).reduce((a, b) => a + b.miles, 0);
  const income = payments.reduce((a, b) => a + b.amount, 0);
  const spent = expenses.reduce((a, b) => a + b.amount, 0);
  const groups = new Map<string, number>();
  for (const e of expenses)
    groups.set(
      accountantGroup[e.category],
      (groups.get(accountantGroup[e.category]) ?? 0) + e.amount,
    );
  const byMethod = paymentMethods
    .map((m) => ({
      method: m,
      total: payments.filter((p) => p.method === m).reduce((a, b) => a + b.amount, 0),
    }))
    .filter((x) => x.total > 0);
  return {
    payments,
    expenses,
    miles,
    income,
    spent,
    profit: income - spent,
    groups: [...groups.entries()],
    byMethod,
  };
}

function summaryPdf(state: MarceloState, year: string) {
  const n = yearNumbers(state, year);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = 60;
  doc.setFont("helvetica", "bold").setFontSize(18).text(`Resumen ${year}`, 56, y);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(
    safe(`${state.profile.name} · ${state.profile.trade} · ${state.profile.city}`),
    56,
    (y += 18),
  );

  const row = (label: string, value: string, bold = false) => {
    y += 18;
    doc
      .setFont("helvetica", bold ? "bold" : "normal")
      .text(safe(label), 56, y)
      .text(value, 556, y, { align: "right" });
  };
  y += 20;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(13)
    .text("Ingresos", 56, (y += 10));
  doc.setFontSize(11);
  for (const m of n.byMethod) row(paymentMethodLabel[m.method], usd(m.total));
  row("Total ingresos", usd(n.income), true);

  y += 16;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(13)
    .text("Gastos", 56, (y += 10));
  doc.setFontSize(11);
  for (const [g, total] of n.groups.sort((a, b) => b[1] - a[1])) row(g, usd(total));
  row("Total gastos", usd(n.spent), true);

  y += 16;
  row("Ganancia", usd(n.profit), true);
  row("Millas registradas", `${n.miles.toFixed(1)} mi`);
  row("Recibos con foto", `${n.expenses.filter((e) => e.receipt).length} de ${n.expenses.length}`);

  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(
    doc.splitTextToSize(
      "Preparado con Marcelo a partir de lo que anotó el usuario. Marcelo organiza la información y no reemplaza a un contador ni da consejos de impuestos.",
      500,
    ),
    56,
    740,
  );
  return doc;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csv(state: MarceloState, year: string) {
  const n = yearNumbers(state, year);
  const name = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "Cliente";
  const rows: (string | number)[][] = [
    ["Tipo", "Fecha", "Concepto", "Categoría contable", "Detalle", "Monto"],
    ...n.payments.map((p) => [
      "Ingreso",
      p.date,
      `Pago de ${name(p.clientId)}`,
      "",
      paymentMethodLabel[p.method],
      p.amount,
    ]),
    ...n.expenses.map((e) => [
      "Gasto",
      e.date,
      e.store ?? e.category,
      accountantGroup[e.category],
      e.note ?? "",
      -e.amount,
    ]),
    ...state.miles
      .filter((m) => m.date.startsWith(year))
      .map((m) => ["Millas", m.date, m.note ?? "Viaje", "Vehículo", `${m.miles} mi`, ""]),
  ];
  // BOM so Excel opens accents correctly.
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export async function accountantZip(state: MarceloState, year: string) {
  const zip = new JSZip();
  zip.file(`resumen-${year}.pdf`, summaryPdf(state, year).output("arraybuffer"));
  zip.file(`movimientos-${year}.csv`, csv(state, year));
  const receipts = zip.folder("recibos");
  for (const e of state.expenses.filter((x) => x.date.startsWith(year) && x.receipt)) {
    const [meta, b64] = e.receipt!.split(",");
    const ext = meta?.includes("png") ? "png" : "jpg";
    receipts?.file(
      `${e.date}-${e.category}-${e.amount}.${ext}`.replace(/[^\w.-]/g, "_"),
      b64 ?? "",
      { base64: true },
    );
  }
  return zip.generateAsync({ type: "blob" });
}

/** "Enviar a mi contador": the ZIP (PDF + CSV + receipts) through the phone's share sheet. */
export async function sendToAccountant(state: MarceloState, year: string) {
  const blob = await accountantZip(state, year);
  const who = (state.profile.name || "marcelo").split(" ")[0]!.toLowerCase();
  return share(
    [new File([blob], `${who}-contador-${year}.zip`, { type: "application/zip" })],
    `Resumen ${year}`,
  );
}

export async function downloadSummaryPdf(state: MarceloState, year: string) {
  const doc = summaryPdf(state, year);
  return share(
    [new File([doc.output("blob")], `resumen-${year}.pdf`, { type: "application/pdf" })],
    `Resumen ${year}`,
  );
}
