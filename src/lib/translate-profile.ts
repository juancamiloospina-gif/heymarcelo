/**
 * Translates the user's tagline and "about me" to English when the page is published, so the
 * client reads English. Done once per change (the result is kept), with the same translator and
 * monthly cap as the rest of the app. If it fails, the page shows the original text.
 */
import type { Profile } from "./marcelo-data";

type TranslateFn = (input: {
  text: string;
  to: "en" | "es";
  trade: string;
  recent: { from: "user" | "client"; text: string }[];
}) => Promise<{ ok: true; text: string } | { ok: false; reason: "limit" | "error"; reply: string }>;

export type TranslateStatus = "ok" | "limit" | "failed";

/** Same limits as the columns in `supabase/migrations`. */
const MAX_EN = { bio: 900, tagline: 80 } as const;

export async function translateForPage(
  profile: Profile,
  translateFn?: TranslateFn,
): Promise<{ patch: Partial<Profile>; status: TranslateStatus }> {
  const run = translateFn ?? (await import("./ai/ask")).translate;
  const bio = (profile.bio ?? "").trim();
  const tagline = (profile.tagline ?? "").trim();
  let status: TranslateStatus = "ok";

  const one = async (
    source: string,
    done: string | undefined,
    current: string | undefined,
    max: number,
  ): Promise<string> => {
    if (!source) return "";
    if (done === source && current) return current; // already translated, nothing changed
    let res: Awaited<ReturnType<TranslateFn>>;
    try {
      res = await run({ text: source, to: "en", trade: profile.trade, recent: [] });
    } catch {
      // A translation problem must never stop the page from being published.
      if (status === "ok") status = "failed";
      return "";
    }
    if (!res.ok) {
      status = res.reason === "limit" ? "limit" : status === "limit" ? "limit" : "failed";
      return "";
    }
    // A cut-off translation reads worse than the original: better none.
    if (!res.text || res.text.length > max) {
      if (status === "ok") status = "failed";
      return "";
    }
    return res.text;
  };

  const [bioEn, taglineEn] = await Promise.all([
    one(bio, profile.translatedBio, profile.bioEn, MAX_EN.bio),
    one(tagline, profile.translatedTagline, profile.taglineEn, MAX_EN.tagline),
  ]);

  return {
    status,
    patch: {
      bioEn,
      taglineEn,
      // Only mark a text as translated when we have its translation.
      translatedBio: bioEn ? bio : undefined,
      translatedTagline: taglineEn ? tagline : undefined,
    },
  };
}
