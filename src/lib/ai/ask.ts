/**
 * The only entry point the UI uses to talk to an AI. Routes to the user's own AI when connected
 * (unlimited, Marcelo pays nothing) or to the included assistant within its monthly ceiling.
 */
import { askMarcelo, translateMarcelo } from "@/lib/marcelo.functions";
import { parseModelText, type MarceloAction } from "./actions";
import { addUsage, costOf, getOwnAI, getUsage, INCLUDED_LIMIT_USD } from "./config";
import {
  LIMITS,
  SYSTEM_PROMPT,
  TRANSLATE_LIMITS,
  TRANSLATE_PROMPT,
  buildTranslateMessage,
  buildUserMessage,
} from "./prompt";
import { askOwnAI, friendlyError } from "./providers";

export type AskResult =
  | { ok: true; reply: string; action: MarceloAction | null; source: "own" | "included" }
  | { ok: false; reply: string; reason: "limit" | "error" };

const nextMonthName = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toLocaleDateString("es-US", { month: "long" });
};

export async function ask(input: {
  text: string;
  today: string;
  snapshot: string;
}): Promise<AskResult> {
  const text = input.text.slice(0, LIMITS.text);
  const snapshot = input.snapshot.slice(0, LIMITS.snapshot);

  const own = getOwnAI();
  if (own) {
    try {
      const raw = await askOwnAI(own, SYSTEM_PROMPT, buildUserMessage(text, input.today, snapshot));
      return { ok: true, ...parseModelText(raw), source: "own" };
    } catch (e) {
      return {
        ok: false,
        reason: "error",
        reply: friendlyError(e),
      };
    }
  }

  if (getUsage().usd >= INCLUDED_LIMIT_USD) {
    return {
      ok: false,
      reason: "limit",
      reply: `Se acabaron las conversaciones de este mes. Vuelven el 1 de ${nextMonthName()}. Puedes ampliarlas en Configuración.`,
    };
  }

  const res = await askMarcelo({ data: { text, today: input.today, snapshot } });
  if (!res.ok) return { ok: false, reason: "error", reply: res.reply };
  addUsage(costOf(res.usage.model, res.usage.inputTokens, res.usage.outputTokens));
  return { ok: true, ...parseModelText(res.text), source: "included" };
}

export type TranslateResult =
  { ok: true; text: string } | { ok: false; reply: string; reason: "limit" | "error" };

/** Interpreter mode: the same routing (own AI or included), but a tiny plain-text prompt. */
export async function translate(input: {
  text: string;
  to: "en" | "es";
  trade: string;
  recent: { from: "user" | "client"; text: string }[];
}): Promise<TranslateResult> {
  const data = {
    text: input.text.slice(0, TRANSLATE_LIMITS.text),
    to: input.to,
    trade: input.trade.slice(0, 80),
    recent: input.recent
      .slice(-4)
      .map((r) => ({ from: r.from, text: r.text.slice(0, TRANSLATE_LIMITS.recentLine) })),
  };
  const clean = (t: string) => t.replace(/^["“”']+|["“”']+$/g, "").trim();

  const own = getOwnAI();
  if (own) {
    try {
      const raw = await askOwnAI(own, TRANSLATE_PROMPT, buildTranslateMessage(data), {
        json: false,
        maxTokens: TRANSLATE_LIMITS.outputTokens,
      });
      return raw
        ? { ok: true, text: clean(raw) }
        : { ok: false, reason: "error", reply: "No me llegó la traducción." };
    } catch (e) {
      return { ok: false, reason: "error", reply: friendlyError(e) };
    }
  }

  if (getUsage().usd >= INCLUDED_LIMIT_USD) {
    return {
      ok: false,
      reason: "limit",
      reply:
        "Se acabó el asistente incluido de este mes. Conecta tu IA en Más → Tu IA para seguir traduciendo.",
    };
  }
  const res = await translateMarcelo({ data });
  if (!res.ok) return { ok: false, reason: "error", reply: res.reply };
  addUsage(costOf(res.usage.model, res.usage.inputTokens, res.usage.outputTokens));
  return res.text
    ? { ok: true, text: clean(res.text) }
    : { ok: false, reason: "error", reply: "No me llegó la traducción." };
}
