import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  text: z.string().min(1).max(1000),
  today: z.string(),
  snapshot: z.string().max(8000),
});

const SYSTEM = `Eres Marcelo, un asistente personal para trabajadores independientes hispanohablantes en Estados Unidos (jardineros, limpieza, plomeros, etc.).
Hablas SIEMPRE en español latinoamericano natural, cálido y breve. Nunca uses emojis ni terminología técnica.

Recibes lo que el usuario dijo y un resumen de sus datos reales (clientes, trabajos, dinero, pendientes).
Debes responder SOLO con un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:

{
  "reply": "respuesta corta en español (1-2 frases)",
  "confirm": true|false,
  "action": null | uno de:
    {"type":"CREATE_JOB","clientName":"...","date":"YYYY-MM-DD","time":"HH:mm","service":"...","price":120}
    {"type":"CREATE_CLIENT","name":"...","phone":"","address":"","city":"","service":"","price":0}
    {"type":"CREATE_EXPENSE","category":"Gasolina|Herramientas|Materiales|Vehículo|Publicidad|Otros","amount":45,"note":"..."}
    {"type":"RECORD_PAYMENT","clientName":"...","amount":120,"method":"efectivo|zelle|cheque"}
    {"type":"CREATE_PENDING","text":"...","clientName":"","amount":0}
    {"type":"TRANSLATE_MESSAGE","clientName":"...","es":"lo que quiere decir en español","en":"mensaje profesional y cortés en inglés"}
}

Reglas:
- Si el usuario solo pregunta algo (cuánto hice, quién tengo hoy, quién me debe), action = null, confirm = false, y responde usando los datos reales del resumen. Nunca inventes datos.
- Si el usuario pide crear, agendar, registrar o cambiar algo, devuelve la acción y confirm = true, con un "reply" que describa lo que vas a hacer.
- Si falta el precio o el servicio de un cliente conocido, usa el habitual del resumen.
- Fechas relativas ("mañana", "el lunes") se resuelven contra la fecha de hoy que te doy.
- Para TRANSLATE_MESSAGE el inglés debe sonar profesional y educado, escrito por un profesional de servicios a su cliente.`;

export const askMarcelo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, status: 401, reply: "Marcelo no está conectado todavía." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Hoy es ${data.today}.\n\nDatos del usuario:\n${data.snapshot}\n\nEl usuario dijo: "${data.text}"`,
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      let reply = "Marcelo no pudo responder en este momento. Intenta de nuevo.";
      if (res.status === 402)
        reply = "Se acabaron los créditos de Marcelo. Recárgalos para seguir usándolo.";
      if (res.status === 429)
        reply = "Marcelo está recibiendo muchas solicitudes. Espera unos segundos.";
      console.error("marcelo gateway error", res.status, detail.slice(0, 500));
      return { ok: false as const, status: res.status, reply };
    }

    // Consume the stream server-side and return the accumulated answer.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
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
          } catch {
            /* partial frame */
          }
        }
      }
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return {
        ok: true as const,
        reply: cleaned || "No entendí bien. ¿Puedes repetirlo?",
        confirm: false,
        action: null,
      };
    }
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return {
        ok: true as const,
        reply: typeof parsed.reply === "string" ? parsed.reply : "Listo.",
        confirm: Boolean(parsed.confirm && parsed.action),
        action: parsed.action ?? null,
      };
    } catch {
      return { ok: true as const, reply: cleaned, confirm: false, action: null };
    }
  });
