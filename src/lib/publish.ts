/** Publishing the page: translate the texts, send everything to the server, return what to keep. */
import { publishKey, publishProfile } from "./cloud";
import type { MarceloState, Profile } from "./marcelo-data";
import { buildPublicProfile } from "./public-profile";
import { translateForPage, type TranslateStatus } from "./translate-profile";

export async function publishPage(
  state: MarceloState,
  slug: string,
): Promise<{ patch: Partial<Profile>; status: TranslateStatus }> {
  const tr = await translateForPage(state.profile);
  const next: MarceloState = {
    ...state,
    profile: { ...state.profile, ...tr.patch, publicSlug: slug },
  };
  const pub = buildPublicProfile(next);
  await publishProfile(pub, slug);
  return {
    status: tr.status,
    patch: {
      ...tr.patch,
      publicSlug: slug,
      // If a translation failed, leave the page marked as out of date so publishing retries it.
      publishedKey: tr.status === "ok" ? publishKey(pub, slug) : "",
    },
  };
}

/** What to tell the user after publishing. */
export function publishNotice(
  status: TranslateStatus,
  first: boolean,
): { ok: boolean; text: string } {
  if (status === "limit") {
    return {
      ok: false,
      text: "Publicada, pero sin traducir: se acabó el asistente de este mes. Tus clientes ven tu texto en español.",
    };
  }
  if (status === "failed") {
    return {
      ok: false,
      text: "Publicada, pero no pude traducir tu texto. Vuelve a publicar para reintentar.",
    };
  }
  return { ok: true, text: first ? "Página publicada" : "Cambios publicados" };
}
