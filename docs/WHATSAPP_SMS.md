# WhatsApp Business y SMS: estado real y qué falta (20/10/2026)

## Diagnóstico

**No hay ninguna integración real.** Revisado en el código:

| Pieza | Qué hace hoy |
| --- | --- |
| `src/routes/conexiones.tsx` | "Conectar" pide un número y un código de 6 dígitos y **acepta cualquier código** (`setTimeout` de 1.2 s). No llama a ninguna API. |
| `src/lib/marcelo-ops.ts` → `deliver()` | "Enviar" solo agrega el mensaje a la conversación guardada en el teléfono (`localStorage`). No sale nada. |
| `src/lib/flags.ts` → `DEMO_MODE` | `true` por defecto: muestra las etiquetas "Demo" y el botón "Simular mensaje". |
| `src/lib/marcelo.functions.ts` | Solo hay funciones de IA (traducir, asistente, recibos). Ninguna envía mensajes. |
| Servidor | No hay webhook que reciba mensajes de clientes ni secretos de Meta/Twilio. |

Lo que **sí funciona** (son enlaces del teléfono, no integraciones):

- Botón **WhatsApp** de cada trabajo y **"Abrir en WhatsApp con el mensaje listo"** en los mensajes preparados: abre `https://wa.me/1<10 dígitos>?text=…`. El usuario toca "enviar" en WhatsApp.
- Botón de texto **SMS** en Mensajes: abre `sms:<número>?&body=…`.
- Las solicitudes de la página pública llegan por Supabase (no por WhatsApp).

Bugs menores encontrados: `digits()` toma los últimos 10 dígitos y `wa.me/1…` asume EE. UU.; un cliente con número de otro país queda mal. Aceptable por ahora (clientes en EE. UU.).

## Qué falta para que sea real

### WhatsApp (Meta WhatsApp Cloud API)
1. Cuenta de **Meta Business** verificada y una **WhatsApp Business Account**; un número que no esté ya en la app de WhatsApp normal.
2. App de Meta con el producto WhatsApp; **token permanente** (usuario del sistema), `phone_number_id` y `waba_id` como **secretos del servidor** (nunca `VITE_`).
3. **Webhook** público (Edge Function de Supabase) para recibir mensajes: verificación `hub.verify_token` y firma `X-Hub-Signature-256`.
4. **Plantillas aprobadas** (categoría *utility*) para todo mensaje que Marcelo inicie: confirmación, recordatorio 24 h, "voy en camino", factura, **encuesta de calificación**. Fuera de las 24 h desde el último mensaje del cliente solo se pueden mandar plantillas. Aprobación: minutos a 1–2 días.
5. Consentimiento (opt-in) del cliente para recibir mensajes.
6. Tabla de mensajes en Supabase y que la app lea de ahí (hoy todo vive en el teléfono).

### SMS (Twilio)
1. Cuenta Twilio y número. En EE. UU. es **obligatorio registrar la marca y la campaña (A2P 10DLC)**, o un número **toll-free verificado**; sin eso los operadores bloquean los mensajes.
2. Webhook de entrada y salida con firma `X-Twilio-Signature`; credenciales como secretos del servidor.
3. Respetar STOP/START (Twilio lo maneja) y mantener la lista de bajas.

### Costo aproximado
Cada conversación de WhatsApp se cobra por categoría y país (Meta); SMS en EE. UU. por segmento más cargos de carrier. Revisar la tarifa vigente antes de prometer "mensajes ilimitados".

## Prueba que debe hacer el usuario (hoy)

1. Conexiones → conecta tu número de WhatsApp → **"Abrir WhatsApp con mi número"**. *Esperado:* se abre WhatsApp con un chat hacia tu propio número y el texto "Prueba de Marcelo…". Si dice "número no válido", el número no tiene 10 dígitos.
2. Un trabajo con cliente con teléfono → **Terminé** → en el aviso de la encuesta toca **"Abrir en WhatsApp con el mensaje listo"**. *Esperado:* WhatsApp abre con el mensaje y el enlace `…/r/<código>` ya escritos.
3. Abre ese enlace en otro teléfono, califica y espera ~1 minuto con la app abierta. *Esperado:* aviso "Fulano te calificó…" y las estrellas en el trabajo.

El paso 3 solo funciona en la app **publicada** (no en una dirección de prueba) y con la sesión iniciada en Mi página.
