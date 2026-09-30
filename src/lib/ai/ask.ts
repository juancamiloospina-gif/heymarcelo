/**
 * The only entry point the UI uses to talk to an AI. Routes to the user's own AI when connected
 * (unlimited, Marcelo pays nothing) or to the included assistant within its monthly ceiling.
 */
import { askMarcelo } from "@/lib/marcelo.functions";
import { parseModelText, type MarceloAction } from "./actions";
import { addUsage, costOf, getOwnAI, getUsage, INCLUDED_LIMIT_USD, providers } from "./config";
import { LIMITS, SYSTEM_PROMPT, buildUserMessage } from "./prompt";
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
        reply: `${friendlyError(e)} (${providers[own.provider].name})`,
      };
    }
  }

  if (getUsage().usd >= INCLUDED_LIMIT_USD) {
    return {
      ok: false,
      reason: "limit",
      reply: `Usaste todo el asistente incluido de este mes. Conecta tu propia IA en Más → Tu IA para seguir sin límite, o espera al 1 de ${nextMonthName()}.`,
    };
  }

  const res = await askMarcelo({ data: { text, today: input.today, snapshot } });
  if (!res.ok) return { ok: false, reason: "error", reply: res.reply };
  addUsage(costOf(res.usage.model, res.usage.inputTokens, res.usage.outputTokens));
  return { ok: true, ...parseModelText(res.text), source: "included" };
}
