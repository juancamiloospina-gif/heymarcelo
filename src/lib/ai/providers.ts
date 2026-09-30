/**
 * Browser → provider calls for "Tu IA". The user's key goes straight from their phone to their
 * provider; nothing passes through Marcelo's servers.
 */
import Anthropic from "@anthropic-ai/sdk";
import { LIMITS } from "./prompt";
import type { OwnAI, Provider } from "./config";

export class ProviderError extends Error {
  constructor(
    public kind: "auth" | "quota" | "refusal" | "network" | "other",
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 45_000;

const friendly: Record<ProviderError["kind"], string> = {
  auth: "Tu clave no funciona. Revísala en Tu IA.",
  quota: "Tu proveedor de IA dice que no tienes saldo o llegaste a tu límite.",
  refusal: "Tu IA no quiso responder a eso. Intenta decirlo de otra forma.",
  network: "No pude conectar con tu IA. Revisa tu internet.",
  other: "Tu IA no pudo responder en este momento. Intenta de nuevo.",
};
export const friendlyError = (e: unknown) =>
  e instanceof ProviderError ? friendly[e.kind] : friendly.other;

const kindFromStatus = (status: number): ProviderError["kind"] =>
  status === 401 || status === 403 ? "auth" : status === 402 || status === 429 ? "quota" : "other";

async function http(url: string, init: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    throw new ProviderError("network", "network");
  } finally {
    window.clearTimeout(timer);
  }
  if (!res.ok) throw new ProviderError(kindFromStatus(res.status), `HTTP ${res.status}`);
  return res.json();
}

const anthropicClient = (apiKey: string) =>
  // The key belongs to the user and lives on their own device, so browser use is intended here.
  new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: TIMEOUT_MS });

// Claude models that accept effort and server-side refusal fallbacks.
const CLAUDE_WITH_EFFORT = /^claude-(opus-5|opus-4-[678]|sonnet-5|fable-5|sonnet-4-6)/;
const CLAUDE_WITH_FALLBACKS = /^claude-(opus-5-5|opus-5$|fable-5-1|sonnet-5-5)/;

async function askAnthropic(ai: OwnAI, system: string, user: string, opts: AskOptions) {
  const client = anthropicClient(ai.apiKey);
  try {
    const msg = await client.beta.messages.create({
      model: ai.model,
      max_tokens: opts.maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      // Short chat turns: low effort keeps answers fast and cheap for the user.
      ...(CLAUDE_WITH_EFFORT.test(ai.model) ? { output_config: { effort: "low" as const } } : {}),
      ...(CLAUDE_WITH_FALLBACKS.test(ai.model)
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });
    if (msg.stop_reason === "refusal") throw new ProviderError("refusal", "refusal");
    return msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new ProviderError("auth", "auth");
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError("quota", "quota");
    if (e instanceof Anthropic.APIConnectionError) throw new ProviderError("network", "network");
    if (e instanceof Anthropic.APIError && e.status === 402)
      throw new ProviderError("quota", "quota");
    throw new ProviderError("other", String(e));
  }
}

type ChatCompletion = { choices?: { message?: { content?: string } }[] };

async function askOpenAICompatible(
  url: string,
  ai: OwnAI,
  system: string,
  user: string,
  json: boolean,
) {
  const data = (await http(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  })) as ChatCompletion;
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
};

async function askGemini(ai: OwnAI, system: string, user: string, opts: AskOptions) {
  const data = (await http(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": ai.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
          maxOutputTokens: opts.maxTokens,
        },
      }),
    },
  )) as GeminiResponse;
  const c = data.candidates?.[0];
  if (c?.finishReason === "SAFETY") throw new ProviderError("refusal", "refusal");
  return (c?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export type AskOptions = { json: boolean; maxTokens: number };

export function askOwnAI(
  ai: OwnAI,
  system: string,
  user: string,
  opts: AskOptions = { json: true, maxTokens: LIMITS.outputTokens },
): Promise<string> {
  switch (ai.provider) {
    case "anthropic":
      return askAnthropic(ai, system, user, opts);
    case "openai":
      return askOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        ai,
        system,
        user,
        opts.json,
      );
    case "openrouter":
      return askOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        ai,
        system,
        user,
        false,
      );
    case "gemini":
      return askGemini(ai, system, user, opts);
  }
}

/** Checks the key and returns the chat models it can use, best guess first. */
export async function listModels(provider: Provider, apiKey: string): Promise<string[]> {
  switch (provider) {
    case "anthropic": {
      const client = anthropicClient(apiKey);
      const ids: string[] = [];
      try {
        for await (const m of client.models.list()) ids.push(m.id);
      } catch (e) {
        if (
          e instanceof Anthropic.AuthenticationError ||
          e instanceof Anthropic.PermissionDeniedError
        )
          throw new ProviderError("auth", "auth");
        if (e instanceof Anthropic.APIConnectionError)
          throw new ProviderError("network", "network");
        throw new ProviderError("other", String(e));
      }
      return preferFirst(ids, ["claude-opus-5-5"]);
    }
    case "openai": {
      const data = (await http("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      })) as { data?: { id: string }[] };
      const ids = (data.data ?? [])
        .map((m) => m.id)
        .filter(
          (id) =>
            /^(gpt-|o\d)/.test(id) &&
            !/(audio|realtime|image|tts|transcribe|search|embedding)/.test(id),
        )
        .sort()
        .reverse();
      return ids;
    }
    case "gemini": {
      const data = (await http(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
        {
          headers: { "x-goog-api-key": apiKey },
        },
      )) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const ids = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((id) => id.startsWith("gemini") && !/(image|tts|embedding|live|audio)/.test(id))
        .sort()
        .reverse();
      return preferFirst(
        ids,
        ids.filter((id) => id.includes("flash") && !id.includes("lite")).slice(0, 1),
      );
    }
    case "openrouter": {
      // Verifies the key; the model catalog itself is public.
      await http("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = (await http("https://openrouter.ai/api/v1/models", {})) as {
        data?: { id: string }[];
      };
      return preferFirst(
        (data.data ?? []).map((m) => m.id),
        ["openrouter/auto"],
      );
    }
  }
}

const preferFirst = (ids: string[], preferred: string[]) => {
  const top = preferred.filter((p) => ids.includes(p));
  return [...top, ...ids.filter((id) => !top.includes(id))];
};
