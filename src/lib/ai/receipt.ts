/**
 * Receipt photo → amount, date, store and a suggested category. The user always reviews the
 * result before saving; nothing is stored from here.
 */
import { z } from "zod";
import { readReceiptMarcelo } from "@/lib/marcelo.functions";
import { expenseCategories, type ExpenseCategory } from "@/lib/marcelo-data";
import { addUsage, costOf, getOwnAI, getUsage, INCLUDED_LIMIT_USD } from "./config";
import { RECEIPT_PROMPT } from "./prompt";
import { askOwnAIWithImage, friendlyError } from "./providers";

export type ReceiptRead = {
  amount?: number | undefined;
  date?: string | undefined;
  store?: string | undefined;
  category?: ExpenseCategory | undefined;
};

const schema = z.object({
  amount: z.coerce.number().positive().max(100_000).nullish(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  store: z.string().trim().max(60).nullish(),
  category: z.string().nullish(),
});

/** Downscales a photo to at most `max` px on its long side as JPEG, to keep requests small. */
export function shrinkImage(dataUrl: string, max = 1024, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function parse(raw: string): ReceiptRead {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    const r = schema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    if (!r.success) return {};
    const cat = expenseCategories.find((c) => c.toLowerCase() === r.data.category?.toLowerCase());
    return {
      amount: r.data.amount ?? undefined,
      date: r.data.date ?? undefined,
      store: r.data.store ?? undefined,
      category: cat,
    };
  } catch {
    return {};
  }
}

export async function readReceipt(
  photo: string,
): Promise<{ ok: true; read: ReceiptRead } | { ok: false; reply: string }> {
  const image = await shrinkImage(photo);
  const own = getOwnAI();
  if (own) {
    try {
      return {
        ok: true,
        read: parse(await askOwnAIWithImage(own, RECEIPT_PROMPT, "Lee este recibo.", image)),
      };
    } catch (e) {
      return { ok: false, reply: friendlyError(e) };
    }
  }
  if (getUsage().usd >= INCLUDED_LIMIT_USD) {
    return {
      ok: false,
      reply: "Se acabaron las lecturas de recibos este mes. Escribe el gasto a mano.",
    };
  }
  try {
    const res = await readReceiptMarcelo({ data: { image } });
    if (!res.ok) return { ok: false, reply: "No pude leer el recibo. Escribe los datos a mano." };
    addUsage(costOf(res.usage.model, res.usage.inputTokens, res.usage.outputTokens));
    return { ok: true, read: parse(res.text) };
  } catch {
    return { ok: false, reply: "No pude leer el recibo. Escribe los datos a mano." };
  }
}

/** "Gasté 45 en gasolina" → amount and category, locally (no AI, no cost). */
export function parseSpokenExpense(text: string): ReceiptRead {
  const t = text.toLowerCase();
  const amount = Number(t.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/)?.[1]?.replace(",", "."));
  const words: [RegExp, ExpenseCategory][] = [
    [/gasolina|gas\b|diesel|chevron|shell|arco/, "Gasolina"],
    [/herramienta|tijera|podadora|motosierra|soplador/, "Herramientas"],
    [/material|bolsa|guante|fertilizante|semilla|tierra|mulch|abono/, "Materiales"],
    [/carro|camioneta|troca|llanta|aceite|mec[aá]nico|veh[ií]culo/, "Vehículo"],
    [/anuncio|volante|publicidad|tarjetas?/, "Publicidad"],
    [/seguro/, "Seguro"],
    [/tel[eé]fono|celular|internet|plan/, "Teléfono"],
    [/ayudante|trabajador|ayuda|helper/, "Ayudantes"],
  ];
  return {
    amount: amount > 0 ? amount : undefined,
    category: words.find(([re]) => re.test(t))?.[1],
  };
}
