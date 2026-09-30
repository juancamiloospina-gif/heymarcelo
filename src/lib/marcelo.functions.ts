import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  LIMITS,
  SYSTEM_PROMPT,
  TRANSLATE_LIMITS,
  RECEIPT_PROMPT,
  TRANSLATE_PROMPT,
  buildTranslateMessage,
  buildUserMessage,
} from "./ai/prompt";

const inputSchema = z.object({
  text: z.string().min(1).max(LIMITS.text),
  today: z.string().max(20),
  snapshot: z.string().max(LIMITS.snapshot),
});

/**
 * Included AI (Marcelo pays), one model per task. The assistant builds actions, so it gets the
 * stronger Flash; translation and receipts are simple and high-volume, so they use Flash-Lite.
 * The backup is always another inexpensive Gemini — never a premium model.
 */
const MODELS = {
  assistant: ["google/gemini-3.8-flash", "google/gemini-3.1-flash-lite"],
  translate: ["google/gemini-3.1-flash-lite", "google/gemini-3.8-flash"],
  receipt: ["google/gemini-3.1-flash-lite", "google/gemini-3.8-flash"],
} as const;

type Task = keyof typeof MODELS;

type Usage = { model: string; inputTokens: number; outputTokens: number };

type UserContent =
  string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

// Gemini models only answer on the OpenAI-compatible chat endpoint (/v1/responses is OpenAI-only).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TIMEOUT_MS = 30_000;

type ChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function callGateway(
  apiKey: string,
  model: string,
  system: string,
  user: UserContent,
  maxTokens: number,
) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(GATEWAY_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries the task's models in order. Moves to the backup only when the first one is unavailable
 * (unknown model, overloaded, server error, timeout) and logs why; credit/rate errors stop here.
 */
async function runGateway(task: Task, system: string, user: UserContent, maxTokens: number) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { ok: false as const, status: 401, reply: "Marcelo no está conectado todavía." };
  }
  const models = MODELS[task];
  for (const [i, model] of models.entries()) {
    const isLast = i === models.length - 1;
    let res: Response;
    try {
      res = await callGateway(apiKey, model, system, user, maxTokens);
    } catch (e) {
      console.error(`marcelo gateway ${task}: ${model} did not answer`, String(e));
      if (!isLast) continue;
      return {
        ok: false as const,
        status: 504,
        reply: "Marcelo tardó demasiado. Intenta otra vez.",
      };
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as ChatResponse;
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      const usage: Usage = {
        model,
        inputTokens: Number(data.usage?.prompt_tokens) || 0,
        outputTokens: Number(data.usage?.completion_tokens) || 0,
      };
      // Gateway didn't report usage: estimate from length (~3 chars per token) so the meter still moves.
      if (!usage.inputTokens) {
        usage.inputTokens =
          typeof user === "string" ? Math.ceil((system.length + user.length) / 3) : 1800;
      }
      if (!usage.outputTokens) usage.outputTokens = Math.ceil(text.length / 3) + 200;
      if (i > 0) console.warn(`marcelo gateway ${task}: answered by backup ${model}`);
      return { ok: true as const, text, usage };
    }

    const detail = await res.text().catch(() => "");
    console.error(`marcelo gateway ${task}: ${model} → ${res.status}`, detail.slice(0, 300));
    if (res.status === 402) {
      return {
        ok: false as const,
        status: 402,
        reply: "Se acabaron los créditos de Marcelo. Recárgalos para seguir usándolo.",
      };
    }
    if (res.status === 429) {
      return {
        ok: false as const,
        status: 429,
        reply: "Marcelo está recibiendo muchas solicitudes. Espera unos segundos.",
      };
    }
    const unavailable = res.status === 400 || res.status === 404 || res.status >= 500;
    if (unavailable && !isLast) continue;
    return {
      ok: false as const,
      status: res.status,
      reply: "Marcelo no pudo responder en este momento. Intenta de nuevo.",
    };
  }
  return { ok: false as const, status: 500, reply: "Marcelo no pudo responder en este momento." };
}

export const askMarcelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) =>
    runGateway(
      "assistant",
      SYSTEM_PROMPT,
      buildUserMessage(data.text, data.today, data.snapshot),
      LIMITS.outputTokens,
    ),
  );

const translateSchema = z.object({
  text: z.string().min(1).max(TRANSLATE_LIMITS.text),
  to: z.enum(["en", "es"]),
  trade: z.string().max(80),
  recent: z
    .array(
      z.object({
        from: z.enum(["user", "client"]),
        text: z.string().max(TRANSLATE_LIMITS.recentLine),
      }),
    )
    .max(4),
});

/** Interpreter mode and client-message translation: tiny prompt, short answer. */
export const translateMarcelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => translateSchema.parse(data))
  .handler(({ data }) =>
    runGateway(
      "translate",
      TRANSLATE_PROMPT,
      buildTranslateMessage(data),
      TRANSLATE_LIMITS.outputTokens,
    ),
  );

const receiptSchema = z.object({
  // A downscaled JPEG; ~1.5 MB of base64 at most.
  image: z.string().startsWith("data:image/").max(1_600_000),
});

/** Receipt photo on the included gateway. */
export const readReceiptMarcelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => receiptSchema.parse(data))
  .handler(({ data }) =>
    runGateway(
      "receipt",
      RECEIPT_PROMPT,
      [
        { type: "text", text: "Lee este recibo." },
        { type: "image_url", image_url: { url: data.image } },
      ],
      800,
    ),
  );
