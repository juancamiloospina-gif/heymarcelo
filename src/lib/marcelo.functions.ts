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
 * Included assistant (Marcelo pays). A fast, inexpensive model first; if the gateway doesn't
 * know it, fall back once to the model the app used before so the assistant never goes dark.
 */
const MODELS = ["google/gemini-3.8-flash", "openai/gpt-6-astra"] as const;

type Usage = { model: string; inputTokens: number; outputTokens: number };

type GatewayInput =
  string | ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string })[];

async function callGateway(
  apiKey: string,
  model: string,
  system: string,
  user: GatewayInput,
  maxTokens: number,
) {
  return fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      stream: true,
      store: false,
      max_output_tokens: maxTokens,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
}

/** Reads the SSE stream: accumulated text plus the token usage reported at the end. */
async function readStream(body: ReadableStream<Uint8Array>, model: string) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const usage: Usage = { model, inputTokens: 0, outputTokens: 0 };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string")
            text += evt.delta;
          if (evt.type === "response.completed" && evt.response?.usage) {
            usage.inputTokens = Number(evt.response.usage.input_tokens) || 0;
            usage.outputTokens = Number(evt.response.usage.output_tokens) || 0;
          }
        } catch {
          /* partial frame */
        }
      }
    }
  }
  return { text, usage };
}

/** One gateway round with model fallback; never throws. */
async function runGateway(system: string, user: GatewayInput, maxTokens: number) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { ok: false as const, status: 401, reply: "Marcelo no está conectado todavía." };
  }
  for (const [i, model] of MODELS.entries()) {
    const res = await callGateway(apiKey, model, system, user, maxTokens);
    if (res.ok && res.body) {
      const { text, usage } = await readStream(res.body, model);
      // Gateway didn't report usage: estimate from length (~3 chars per token) so the meter still moves.
      if (!usage.inputTokens)
        usage.inputTokens =
          typeof user === "string" ? Math.ceil((system.length + user.length) / 3) : 1800;
      if (!usage.outputTokens) usage.outputTokens = Math.ceil(text.length / 3) + 200;
      return { ok: true as const, text, usage };
    }
    const detail = await res.text().catch(() => "");
    const unknownModel = (res.status === 400 || res.status === 404) && i < MODELS.length - 1;
    console.error("marcelo gateway error", model, res.status, detail.slice(0, 300));
    if (unknownModel) continue;

    let reply = "Marcelo no pudo responder en este momento. Intenta de nuevo.";
    if (res.status === 402)
      reply = "Se acabaron los créditos de Marcelo. Recárgalos para seguir usándolo.";
    if (res.status === 429)
      reply = "Marcelo está recibiendo muchas solicitudes. Espera unos segundos.";
    return { ok: false as const, status: res.status, reply };
  }
  return { ok: false as const, status: 500, reply: "Marcelo no pudo responder en este momento." };
}

export const askMarcelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) =>
    runGateway(
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

/** Interpreter mode on the included gateway: tiny prompt, short answer. */
export const translateMarcelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => translateSchema.parse(data))
  .handler(({ data }) =>
    runGateway(TRANSLATE_PROMPT, buildTranslateMessage(data), TRANSLATE_LIMITS.outputTokens),
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
      RECEIPT_PROMPT,
      [
        { type: "input_text", text: "Lee este recibo." },
        { type: "input_image", image_url: data.image },
      ],
      800,
    ),
  );
