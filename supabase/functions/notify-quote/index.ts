// Edge Function `notify-quote`: manda avisos al teléfono (Web Push) cuando llega una solicitud.
//
//  POST  { id }            Lo llama el trigger de la base de datos. No confía en lo que recibe:
//                          lee la solicitud de la base y la "reclama" con notified_at, así un
//                          mismo id nunca avisa dos veces.
//  GET   ?action=key       Devuelve la llave pública que necesita el teléfono para suscribirse
//                          (la crea la primera vez).
//  POST  ?action=test      Con la sesión del usuario: manda un aviso de prueba a sus teléfonos.
//
// Se despliega con la verificación de acceso activa: el trigger la llama con la llave pública del
// proyecto y la app con la sesión del usuario.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Quién envía los avisos (lo exige el estándar). No es un dato personal.
const SUBJECT = "https://heymarcelo.lovable.app";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
const clip = (s: unknown, n: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const read = () =>
    admin.from("push_config").select("public_key, private_key").eq("id", 1).maybeSingle();
  const first = await read();
  if (first.data) return { publicKey: first.data.public_key, privateKey: first.data.private_key };
  const fresh = webpush.generateVAPIDKeys();
  // Si dos llamadas llegan a la vez, gana la primera y la otra lee esa misma.
  await admin
    .from("push_config")
    .upsert(
      { id: 1, public_key: fresh.publicKey, private_key: fresh.privateKey },
      { onConflict: "id", ignoreDuplicates: true },
    );
  const again = await read();
  if (!again.data) throw new Error("vapid_keys_unavailable");
  return { publicKey: again.data.public_key, privateKey: again.data.private_key };
}

async function sendTo(
  ownerId: string,
  payload: { title: string; body: string; url: string; tag: string },
) {
  const keys = await vapidKeys();
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("owner_id", ownerId);
  let sent = 0;
  let removed = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          // El teléfono ya no recibe avisos (desinstaló o los apagó): se olvida.
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("push failed", code, (e as { body?: string }).body ?? String(e));
        }
      }
    }),
  );
  return { phones: subs?.length ?? 0, sent, removed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const action = new URL(req.url).searchParams.get("action");
  try {
    if (action === "key") return json({ publicKey: (await vapidKeys()).publicKey });

    if (action === "test") {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data } = await admin.auth.getUser(jwt);
      if (!data.user) return json({ error: "not_signed_in" }, 401);
      return json(
        await sendTo(data.user.id, {
          title: "Aviso de prueba",
          body: "Así te avisaré cuando llegue una solicitud de cotización.",
          url: "/bandeja",
          tag: "marcelo-test",
        }),
      );
    }

    // Desde la base de datos: una solicitud nueva.
    const body = await req.json().catch(() => null);
    const id = body?.id;
    if (typeof id !== "string" || !UUID.test(id)) return json({ error: "bad_request" }, 400);

    const { data: claimed } = await admin
      .from("quote_requests")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", id)
      .is("notified_at", null)
      .select("name, service, description, outside_area, profile_id")
      .maybeSingle();
    if (!claimed) return json({ skipped: true }); // no existe o ya se avisó

    const { data: profile } = await admin
      .from("profiles")
      .select("owner_id")
      .eq("id", claimed.profile_id)
      .maybeSingle();
    if (!profile) return json({ skipped: true });

    const what = clip(claimed.service, 60) || clip(claimed.description, 80) || "Cotización";
    return json(
      await sendTo(profile.owner_id, {
        title: `Nueva solicitud de ${clip(claimed.name, 40)}`,
        body: claimed.outside_area ? `${what} · Fuera de tu zona` : what,
        url: "/bandeja",
        tag: `quote-${id}`,
      }),
    );
  } catch (e) {
    console.error("notify-quote error", e);
    return json({ error: "server_error" }, 500);
  }
});
