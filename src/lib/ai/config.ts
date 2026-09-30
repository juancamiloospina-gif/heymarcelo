/**
 * Which AI answers the assistant, and how much of the included allowance is used.
 *
 * - "Tu IA": the user's own provider key. Stored only on this device, in its own storage key
 *   (never inside the app state, so "Descargar mis datos" never exports it). Calls go from the
 *   browser straight to the provider: Marcelo's servers never see the key and pay nothing.
 * - Included: Marcelo's Lovable gateway, capped at INCLUDED_LIMIT_USD per month on this device.
 */
import { useSyncExternalStore } from "react";
import { monthISO } from "@/lib/marcelo-data";

export type Provider = "anthropic" | "openai" | "gemini" | "openrouter";

export type OwnAI = { provider: Provider; apiKey: string; model: string };

export const providers: Record<
  Provider,
  { name: string; company: string; keyUrl: string; keyHint: string }
> = {
  anthropic: {
    name: "Claude",
    company: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-…",
  },
  openai: {
    name: "ChatGPT",
    company: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
  },
  gemini: {
    name: "Gemini",
    company: "Google",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza…",
  },
  openrouter: {
    name: "OpenRouter",
    company: "Muchos modelos con una sola clave",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-…",
  },
};

/** Monthly ceiling for what Marcelo pays per user: assistant, translation and receipts together. */
export const INCLUDED_LIMIT_USD = 4;

/** Typical cost of one assistant turn on the included model, until real usage says otherwise. */
const TYPICAL_TURN_USD = 0.005;

/**
 * USD per million tokens for the gateway models Marcelo uses. Estimates from public provider
 * prices (Sep 2026); check them against Lovable's AI usage dashboard. Unknown models are billed
 * at the most expensive rate so the ceiling is never exceeded by mistake.
 */
export const GATEWAY_PRICES: Record<string, { input: number; output: number }> = {
  "google/gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "openai/gpt-6-astra": { input: 10, output: 50 },
};
const WORST_CASE = { input: 10, output: 50 };

export const costOf = (model: string, inputTokens: number, outputTokens: number) => {
  const p = GATEWAY_PRICES[model] ?? WORST_CASE;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
};

const OWN_KEY = "marcelo.ai.own.v1";
const USAGE_KEY = "marcelo.ai.usage.v1";

type Usage = { month: string; usd: number; calls: number };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
  cache.delete(key);
  emit();
}

// useSyncExternalStore needs stable snapshots between changes.
const cache = new Map<string, unknown>();
function cached<T>(key: string): T | null {
  if (!cache.has(key)) cache.set(key, read<T>(key));
  return cache.get(key) as T | null;
}

export function getOwnAI(): OwnAI | null {
  if (typeof window === "undefined") return null;
  const v = cached<OwnAI>(OWN_KEY);
  return v?.apiKey && v.model && v.provider in providers ? v : null;
}

export const saveOwnAI = (v: OwnAI | null) => write(OWN_KEY, v);

let emptyUsage: Usage = { month: "", usd: 0, calls: 0 };
const empty = () => {
  if (emptyUsage.month !== monthISO()) emptyUsage = { month: monthISO(), usd: 0, calls: 0 };
  return emptyUsage;
};

/** This month's included usage; a new month starts from zero. */
export function getUsage(): Usage {
  if (typeof window === "undefined") return empty();
  const u = cached<Usage>(USAGE_KEY);
  return u && u.month === monthISO() ? u : empty();
}

export function addUsage(usd: number) {
  const u = getUsage();
  write(USAGE_KEY, { month: u.month, usd: u.usd + usd, calls: u.calls + 1 });
}

export const includedLeft = () => Math.max(0, INCLUDED_LIMIT_USD - getUsage().usd);

/** How many more assistant conversations fit in this month's allowance (a plain-language count). */
export function conversationsLeft(u: Usage = getUsage()) {
  const perTurn = u.calls >= 5 ? Math.max(u.usd / u.calls, 0.001) : TYPICAL_TURN_USD;
  return Math.max(0, Math.floor((INCLUDED_LIMIT_USD - u.usd) / perTurn));
}

export function useAIStatus() {
  const own = useSyncExternalStore(subscribe, getOwnAI, () => null);
  const usage = useSyncExternalStore(subscribe, getUsage, getUsage);
  return {
    own,
    usage,
    left: conversationsLeft(usage),
    percentUsed: Math.min(100, Math.round((usage.usd / INCLUDED_LIMIT_USD) * 100)),
    limitReached: !own && usage.usd >= INCLUDED_LIMIT_USD,
  };
}
