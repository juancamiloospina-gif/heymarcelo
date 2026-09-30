/**
 * The complete list of things any model — Marcelo's or the user's own — may ask the app to do.
 * Every action touches only the user's own records (citas, clientes, dinero, pendientes, precios).
 * Anything else the model returns is dropped: it cannot change the app, settings, connections
 * or AI keys, and every write still waits for the user to tap "Confirmar".
 */
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optDate = z
  .string()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined));
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = z.coerce.number().positive().max(100_000);
const optMoney = z.coerce
  .number()
  .min(0)
  .max(100_000)
  .optional()
  .transform((v) => (v ? v : undefined));

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CREATE_JOB"),
    clientName: text(80).min(1),
    date,
    time,
    service: optText(120),
    price: optMoney,
  }),
  z.object({
    type: z.literal("RESCHEDULE_JOB"),
    clientName: text(80).min(1),
    fromDate: optDate,
    date,
    time,
  }),
  z.object({ type: z.literal("CANCEL_JOB"), clientName: text(80).min(1), date: optDate }),
  z.object({
    type: z.literal("CREATE_CLIENT"),
    name: text(80).min(1),
    phone: optText(30),
    address: optText(160),
    city: optText(80),
    service: optText(120),
    price: optMoney,
  }),
  z.object({
    type: z.literal("UPDATE_CLIENT"),
    clientName: text(80).min(1),
    phone: optText(30),
    address: optText(160),
    city: optText(80),
    notes: optText(400),
  }),
  z.object({
    type: z.literal("CREATE_EXPENSE"),
    category: z
      .enum([
        "Gasolina",
        "Herramientas",
        "Materiales",
        "Vehículo",
        "Publicidad",
        "Seguro",
        "Teléfono",
        "Ayudantes",
        "Otros",
      ])
      .catch("Otros"),
    amount: money,
    note: optText(160),
  }),
  z.object({
    type: z.literal("RECORD_PAYMENT"),
    clientName: text(80).min(1),
    amount: money,
    method: z.enum(["efectivo", "zelle", "cashapp", "cheque", "tarjeta"]).catch("efectivo"),
  }),
  z.object({
    type: z.literal("CREATE_PENDING"),
    text: text(200).min(1),
    clientName: optText(80),
    amount: optMoney,
  }),
  z.object({ type: z.literal("COMPLETE_PENDING"), text: text(200).min(1) }),
  z.object({
    type: z.literal("UPDATE_SERVICE_PRICE"),
    serviceName: text(120).min(1),
    price: money,
  }),
  z.object({
    type: z.literal("TRANSLATE_MESSAGE"),
    clientName: text(80).min(1),
    es: text(1000),
    en: text(1500).min(1),
  }),
]);

export type MarceloAction = z.infer<typeof actionSchema>;

/** Actions that only draft something and change no records; everything else needs a tap. */
export const needsConfirmation = (a: MarceloAction) => a.type !== "TRANSLATE_MESSAGE";

/** Turns whatever a model wrote into `{ reply, action }`, discarding anything off-list. */
export function parseModelText(raw: string): { reply: string; action: MarceloAction | null } {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return { reply: cleaned.slice(0, 600) || "No entendí bien. ¿Puedes repetirlo?", action: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { reply: "No entendí bien. ¿Puedes repetirlo?", action: null };
  }
  const obj = (parsed ?? {}) as { reply?: unknown; action?: unknown };
  const reply =
    typeof obj.reply === "string" && obj.reply.trim() ? obj.reply.trim().slice(0, 600) : "Listo.";
  if (!obj.action) return { reply, action: null };
  const action = actionSchema.safeParse(obj.action);
  if (!action.success) {
    // Don't echo the model's promise ("listo, lo borro") for something that will not happen.
    return {
      reply: "Eso no lo puedo hacer desde aquí, o me faltó algún dato. Dímelo de otra forma.",
      action: null,
    };
  }
  return { reply, action: action.data };
}
