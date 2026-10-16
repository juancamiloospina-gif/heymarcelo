# Marcelo: resumen técnico para continuar el proyecto

Última actualización: 14 de octubre de 2026. Todo lo descrito aquí está en `main`, en el PR #6 (commit `a6a39f4`, merge `f7d8a01`).

---

## 1. Objetivo del proyecto

**Marcelo** es una app móvil (web, mobile-first a 390 px) para trabajadores independientes **hispanohablantes de servicios del hogar en EE. UU.** (jardinería, limpieza, plomería…). La mayoría no habla inglés y sus clientes sí.

La app hace cuatro cosas:
1. **Contesta a los clientes por WhatsApp/SMS en inglés** con los precios del usuario, cotiza, agenda y reprograma trabajos sola, y le muestra todo al usuario **en español**.
2. **Traduce en persona** (intérprete de voz) entre el usuario y su cliente.
3. **Organiza el negocio:** trabajos, clientes, cobros, por cobrar, gastos con foto del recibo, millas y recordatorios.
4. **Prepara el paquete para el contador:** PDF + CSV + ZIP de recibos.

Modelo de negocio previsto: **$10 USD/mes** por usuario. El gasto de IA que paga Marcelo tiene un **tope de $4/mes por usuario**. Si el usuario conecta su propia IA, no tiene límite y no le cuesta nada a Marcelo.

Repositorio: `https://github.com/juancamiloospina-gif/heymarcelo` (privado del usuario).
Conectado a **Lovable** (`https://lovable.dev/projects/e36239de-2c76-4f49-af19-27659e155553`, app publicada en `https://heymarcelo.lovable.app`). Lo que se une a `main` se sincroniza con Lovable, y el usuario publica desde allí.

---

## 2. Arquitectura actual

| Capa | Tecnología |
|---|---|
| Framework | **TanStack Start** (React 19 + TanStack Router, rutas por archivo) sobre **Vite 8** y **Nitro** (deploy en Cloudflare Workers vía Lovable) |
| UI | Tailwind CSS v4 (tokens en `src/styles.css`), lucide-react, sonner (toasts), shadcn/ui en `src/components/ui` (casi no se usa) |
| Estado | **Un único store React** (`src/lib/marcelo-store.tsx`) persistido en **`localStorage`**. **No hay backend ni base de datos.** |
| Lógica | Funciones **puras** sobre el estado: `marcelo-ops.ts` (transiciones) y `marcelo-autopilot.ts` (respuestas automáticas). No usan IA. |
| IA incluida | **Server functions** de TanStack (`src/lib/marcelo.functions.ts`) que llaman al **gateway de IA de Lovable** (`/v1/chat/completions`) con `LOVABLE_API_KEY`. |
| IA propia (BYOK) | Llamadas **desde el navegador directo al proveedor** (Anthropic SDK, OpenAI, Gemini, OpenRouter). La clave nunca pasa por el servidor. |
| Voz | Web Speech API (dictado) y `speechSynthesis` (voz), en `src/lib/speech.ts` |
| Documentos | `jspdf` (PDF), `jszip` (ZIP), `qrcode` (QR) en el cliente |
| Gestor de paquetes | **bun** (`bun.lock`); también funciona con npm |

### Flujo de datos

```
UI (routes/*, components/marcelo/*)
   │  useMarcelo()  → acciones del store
   ▼
marcelo-store.tsx ── commit(fn) / run(fn) ──► ref.current (fuente única) ► setState ► localStorage
   │                         │
   │                         └── marcelo-ops.ts (puro): applyResult, queueJobMessage, sendOutbox,
   │                              finishJob, recordPayment, moveJob, tick (automatizaciones)
   │
   ├── marcelo-autopilot.ts (puro, sin IA): runAutopilot(state, conv, texto) → AutopilotResult
   │
   └── lib/ai/ask.ts (único punto de entrada a IA)
          ├── IA propia → providers.ts (navegador → proveedor)
          └── incluida  → marcelo.functions.ts (servidor → gateway Lovable) + medidor de uso
```

- **`commit(fn)` / `run(fn)`**: todas las escrituras pasan por `ref.current`, para que dos acciones seguidas no se pisen. `run` además anuncia eventos con toasts.
- **Automatizaciones** (`ops.tick`): un `setInterval` de **60 s mientras la app está abierta**. Vence cotizaciones a las 48 h (con un solo seguimiento y un hueco nuevo), envía el mensaje puente a los 15 min y prepara recordatorios 24 h antes. **No corren con la app cerrada.**
- **Demo:** WhatsApp/SMS son simulados. Los mensajes "enviados" se añaden a la conversación local. El flag `DEMO_MODE` (en `src/lib/flags.ts`, controlado por `VITE_DEMO_MODE`; por defecto `true`) muestra las etiquetas "Demo" y el botón "Simular mensaje".

---

## 3. Estructura de archivos (lo relevante)

```
src/
  routes/                       (TanStack file routes; routeTree.gen.ts se genera solo en dev/build)
    __root.tsx                  shell HTML, <head>, favicon/manifest, Gate (splash → Onboarding → AppShell)
    index.tsx                   Inicio: saludo, accesos rápidos (Nuevo trabajo · Cobré · Anotar gasto · Traducir),
                                "Necesitan tu atención", Hoy, Recordatorios, "Marcelo te recomienda"
    agenda.tsx                  tira de 21 días con puntos + trabajos del día + Nuevo trabajo
    trabajo.$jobId.tsx          detalle: barra de estados, mensajes al cliente, factura, traducir, cancelar
    bandeja.index.tsx           Mensajes: atención, respuesta automática on/off, lista, simulador (demo)
    bandeja.$conversationId.tsx chat: español primero, Responder (3 opciones), Reactivar Marcelo,
                                "¿No es esto?", tarjeta "¿Mover el trabajo…?"
    clientes.index.tsx / clientes.$clientId.tsx
    dinero.tsx                  ?tab=resumen|cobrar|gastos|contador
    servicios.tsx               precios (planos o por tamaño), horario por día, margen, días bloqueados
    configuracion.tsx           perfil, asistente (Te quedan X), mensajes automáticos, cobros, QR, texto
                                grande, privacidad, Zona de riesgo
    ia.tsx                      "Avanzado: tu propia IA" (BYOK)
    conexiones.tsx              WhatsApp Business / SMS (demo)
    traducir.tsx                intérprete en persona (?clientId=)
    pendientes.tsx              Recordatorios
    mensaje.$clientId.tsx       (legado) borrador de mensaje traducido a un cliente
    mas.tsx, gastos.tsx, documentos.tsx   → solo redirects a /configuracion y /dinero
  components/marcelo/
    shell.tsx        barra inferior; mantener pulsado el micrófono abre /traducir; texto grande (zoom)
    assistant.tsx    overlay de voz; acciones validadas; tarjeta editable de Nuevo trabajo
    jobs.tsx         JobCard, GoSheet (Maps/Waze + millas + "Voy en camino"), FinishSheet (Terminé),
                     PaymentSheet (Cobré), JobDraftCard / NewJobSheet
    attention.tsx    useAttention/AttentionList, OutboxSheet, DecisionSheet, ServiceFixSheet
    reminders.tsx    Swipeable (deslizar), ReminderRow
    quote-link.tsx   enlace wa.me + QR "Pide tu cotización" + volante PDF (Configuración → Consigue clientes)
  (lib) public-profile.ts  PublicProfile + shareUrl(): lo que ve el cliente y a dónde apunta el QR
  (lib) flyer.ts           volante PDF en inglés, solo desde PublicProfile
    kit.tsx          Screen, PageTitle, Card, Button, Field, Badge, Empty, BackButton, Sheet, Tabs, Chips
    visual.tsx       tonos, iconos por servicio/categoría/canal, ClientAvatar, stageLabel
    onboarding.tsx   bienvenida con 3 iconos de confianza + nombre/oficio/ciudad
  lib/
    marcelo-data.ts       tipos, helpers de fecha/dinero, demoState(), migrate()
    marcelo-store.tsx     store, persistencia, tick, toasts de eventos
    marcelo-ops.ts        transiciones puras
    marcelo-autopilot.ts  motor de respuestas, findSlot, conflictsFor, parseWhen, suggestedMove,
                          holdPrice/offerPrice/declineConv, bridge, followup, jobMessage
    marcelo-insights.ts   recomendaciones calculadas con reglas
    marcelo.functions.ts  server functions: askMarcelo, translateMarcelo, readReceiptMarcelo
    ai/ask.ts             ask() y translate(): enrutan a IA propia o incluida + tope
    ai/actions.ts         lista cerrada de acciones (zod) y parseModelText()
    ai/prompt.ts          SYSTEM_PROMPT, TRANSLATE_PROMPT, RECEIPT_PROMPT, límites
    ai/config.ts          BYOK en localStorage, precios, tope $4, medidor, useAIStatus()
    ai/providers.ts       llamadas BYOK (Anthropic SDK / OpenAI / Gemini / OpenRouter), listModels
    ai/receipt.ts         lectura de recibos (foto → monto/fecha/tienda/categoría) + gasto por voz
    reports.ts            factura PDF, resumen PDF, CSV, ZIP, compartir
    speech.ts             dictado, voz, guessLang
    trips.ts              millas por GPS (línea recta)
    flags.ts              DEMO_MODE
  assets/marcelo-logo.png, marcelo-mark.png
public/  favicon.ico, apple-touch-icon.png, icon-192/512(+maskable).png, site.webmanifest (con accesos directos)
docs/HANDOFF.md  (este archivo)
AGENTS.md        nota de Lovable: no reescribir historial publicado (no force-push)
```

---

## 4. "Base de datos": almacenamiento y campos

**No hay base de datos.** Todo vive en `localStorage` del navegador de cada usuario:

| Clave | Contenido |
|---|---|
| `marcelo.state.v1` | `MarceloState` (versión 2), todo el negocio |
| `marcelo.ai.own.v1` | IA propia `{ provider, apiKey, model }`. **Separada a propósito: no sale en "Exportar mis datos".** |
| `marcelo.ai.usage.v1` | medidor del mes `{ month: "YYYY-MM", usd, calls }` |
| `marcelo.trips.v1` | punto GPS de inicio por `jobId` (millas) |

`migrate()` en `marcelo-data.ts` convierte los datos guardados por versiones viejas (estados `por_confirmar`/`completado`, pagos `debe`, pendientes con monto, `workDays`) al formato v2. **Si se cambia el modelo, hay que ampliar `migrate()`.**

### `MarceloState` (v2)
```
version: 2
profile: { name, trade, city, onboarded }
clients:     Client[]
jobs:        Job[]
payments:    Payment[]
receivables: Receivable[]     ("Por cobrar")
expenses:    Expense[]
miles:       MileLog[]
pendings:    Pending[]        ("Recordatorios", nunca dinero)
messages:    Message[]        (legado: borradores ES/EN y conversaciones del traductor guardadas)
services:    Service[]
conversations: Conversation[]
connections: { whatsapp: Connection, sms: Connection }
settings:    Settings
outbox:      OutboxItem[]     (mensajes preparados que esperan un toque)
```

**Client**: `id, name, phone, address, city, service, price, notes?`

**Job**: `id, clientId, date (YYYY-MM-DD), time (HH:mm), service (nombre), serviceId?, price, status, size?, address?, expiresAt? (ISO, cotización +48 h), conversationId?, sent?{confirm,reminder,onTheWay,invoice}, miles?`
- `status`: `consulta | cotizado | confirmado | en_camino | hecho | cobrado | vencido | cancelado`
- Ocupan agenda (`isActiveJob`): `cotizado`, `confirmado`, `en_camino`.

**Payment**: `id, clientId, jobId?, amount, method (efectivo|zelle|cashapp|cheque|tarjeta), date, note?`

**Receivable**: `id, clientId, jobId?, amount, note?, createdAt, paidAt?`

**Expense**: `id, category, amount, note?, store?, date, receipt? (data URL JPEG)`
- `category`: `Gasolina | Herramientas | Materiales | Vehículo | Publicidad | Seguro | Teléfono | Ayudantes | Otros`

**MileLog**: `id, jobId?, date, miles, note?`

**Pending**: `id, text, clientId?, done, createdAt, due?`

**Message** (legado): `id, clientId, es, en, date`

**Service**: `id, name, nameEn (cómo se dice al cliente), price (plano o el de "Mediano"), sizes?{chico,mediano,grande}, minutes, kind (pasto|poda|limpieza|riego|plantas|reparacion|general)`

**Connection**: `connected, number?`

**Conversation**:
```
id, channel (whatsapp|sms), contactName, phone, clientId?, lang (en|es),
stage: nuevo | cotizado | agendado | rechazado | tu_turno (Marcelo pasó el chat) | manual (lo lleva el usuario; Marcelo en pausa)
serviceId?, candidates? (servicios dudosos), price? (precio elegido por el usuario), size?, address?,
awaiting?: address | size | service      (lo que Marcelo preguntó)
prefer?: { day?, hour? }                 (día/hora pedidos, mientras pregunta datos)
proposal?: { date, time }                (hueco ofrecido)
jobId?                                   (trabajo cotizado/agendado de este chat)
pendingMove?: { jobId, date?, time? }    (reprogramación en negociación)
dismissedMove?                           (sugerencia de mover descartada: "jobId:fecha:hora")
handoffAt?, bridgeSent?, followupSent?
messages: InboxMessage[], unread, updatedAt
```

**InboxMessage**: `id, from (client|marcelo|user), text (lo que se envió o recibió, normalmente inglés), es? (traducción al español), note? ("Marcelo entendió: …"), photo?, at (ISO)`

**Settings**: `autoReply, hours: {0..6: {on,start,end}} (0 = domingo), blocked: fechas[], bufferMin, autoMessages: {confirm|reminder|onTheWay: "ask"|"auto"}, paymentInstructions, largeText`

**OutboxItem**: `id, kind (confirm|reminder|onTheWay|invoice), jobId, conversationId, text (EN), es, createdAt`

---

## 5. Funcionalidades implementadas

**Ciclo del trabajo**
- Estados completos y barra de progreso.
- Las cotizaciones vencen a las 48 h, o si ya pasó la fecha ofrecida. Hay un solo seguimiento automático con un hueco nuevo; el trabajo viejo queda como `vencido`.
- **JobCard**: Llamar, WhatsApp (`wa.me/1…`), **Ir** (Google Maps / Waze, pasa el trabajo a "en camino", prepara "Voy en camino" y empieza las millas) y **Terminé**.
- **Terminé**: monto prellenado y método (5 métodos o "Aún no pagó"). Crea el ingreso, o lo deja en Por cobrar, y registra las millas.
- **Cobré**: pago suelto, que puede saldar algo de Por cobrar.
- **Nuevo trabajo** con tarjeta editable y un solo Confirmar. Lo crea la voz ("Agenda a Robert el jueves a las 9…") o los botones.
- Mensajes al cliente (confirmación, recordatorio 24 h, voy en camino, factura): van a `outbox` para un toque, con la opción "Enviar siempre automático".

**Mensajes y respuesta automática** (`marcelo-autopilot.ts`, sin IA)
- Detecta el idioma. Identifica el servicio por palabras clave (prefijos, ignora palabras genéricas). Si dos servicios encajan, o el cliente une dos con "and/y", **pregunta**.
- Pide **dirección con ZIP** y **tamaño o foto** antes de cotizar. Con foto da el rango y pasa el chat al usuario.
- Cotiza solo con los precios de la tabla (`allowedPrice`). **Freno en `applyResult`:** si el precio no coincide, bloquea y pasa el chat al usuario.
- `findSlot`: horario por día, días bloqueados, margen, nunca en las próximas 2 h y prefiere días con trabajos en el mismo ZIP.
- Si el cliente acepta, el trabajo pasa a `confirmado`. Si rechaza, pasa a `cancelado`.
- Si pide descuento o hace preguntas raras, el chat queda en `tu_turno` (pasa al usuario). Hay **mensaje puente** a los 15 min.
- **Responder**: Mantener precio / Ofrecer 10% / Declinar, con vista previa EN+ES.
- **"¿No es esto?"**: corregir el servicio entendido.
- **Reprogramación**: "reschedule / tomorrow at the same time / Friday at 10".
  - Si el hueco está libre, mueve el trabajo.
  - Si choca, ofrece el hueco libre más cercano.
- **Tarjeta "¿Mover el trabajo…?"**: aparece cuando el usuario lleva el chat y se habla de otra fecha u hora. Muestra los choques (otros trabajos, horario, día bloqueado) y mueve el trabajo con un toque, preparando la confirmación.
- Al escribir el usuario a mano, el chat pasa a `manual`. **Reactivar Marcelo** lo devuelve a `agendado`, `cotizado` o `nuevo`.
- **Todo en español para el usuario**: cada mensaje en inglés del cliente se traduce al llegar (`translateClientMessage`, con Flash-Lite). Hay botón "Ver en español" para reintentar. Las burbujas, la lista y Responder muestran primero el español.

**Asistente de voz** (`assistant.tsx`)
- Dictado en español y voz natural.
- La IA devuelve JSON con **una de 11 acciones validadas con zod** (`ai/actions.ts`). **Toda acción que cambia datos pide Confirmar.** Cualquier otra cosa se descarta.
- Decir "traduce…" abre el intérprete sin gastar IA.
- Tiene 3 ejemplos tocables y una etiqueta "Quedan N".

**Intérprete** (`traducir.tsx`)
- Pantalla partida, con la mitad del cliente volteada. Dictado por lado, traducción en voz alta y tocar para repetir.
- **Modo continuo**: el micrófono pasa solo al otro lado.
- Detección de idioma al escribir.
- **Cifras con "¿Correcto?"**: precios, horas y números.
- **10 frases rápidas** con traducción fija, que no gastan IA.
- Guardar la conversación en la ficha del cliente.

**Dinero**
- Resumen (Ganancia, Cobrado, Gastos, movimientos).
- Por cobrar.
- **Gastos**: primero la foto, con **lectura del recibo por IA**. También por voz ("gasté 45 en gasolina", interpretado sin IA). Sin categoría por defecto, editar y deshacer, botón Guardar fijo.
- **Contador**:
  - "Enviar a mi contador": ZIP con PDF de una página, CSV con categoría contable y fotos de recibos, por el menú de compartir del teléfono.
  - Categorías agrupadas como las piden los contadores.
  - Fechas de pagos estimados con "Consúltalo con tu contador".
  - Explicación del 1099-K y aviso de que Marcelo no reemplaza a un contador.
- **Facturas** en inglés (PDF) desde el trabajo.

**IA y costos**
- **Incluida** (servidor → gateway Lovable, `/v1/chat/completions`):
  - asistente: `google/gemini-3.8-flash`, con respaldo `google/gemini-3.1-flash-lite`;
  - traducción y recibos: `google/gemini-3.1-flash-lite`, con respaldo `3.8-flash`.
  - Solo pasa al respaldo si el modelo no está disponible, y lo registra en el log. Ante errores de créditos (402) o de límite (429) no salta: avisa al usuario.
- **Tope $4/mes por usuario** (asistente + traducción + recibos), medido con los tokens que devuelve el gateway y `GATEWAY_PRICES`.
- **IA propia (BYOK)** en Configuración → Avanzado: Claude, ChatGPT, Gemini u OpenRouter. Prueba la clave, lista los modelos, es ilimitada y no le cuesta nada a Marcelo.

**Otros**
- Navegación: **Inicio · Agenda · 🎤 · Mensajes · Dinero**. Configuración se abre desde el avatar.
- Recomendaciones con reglas en Inicio.
- Recordatorios con casilla, "Vencido hace N días" y deslizar.
- Onboarding con 3 iconos de confianza.
- Logo e iconos (PWA con accesos directos a Traducir y Gasto).
- Texto grande. Zona de riesgo con exportar datos y doble confirmación.
- Enlace y QR "Pide tu cotización" (`wa.me` del número de WhatsApp Business).
- Glosario: Trabajo, Por cobrar, Ganancia, Recordatorio, Desde/Hasta; días de 3 letras.

---

## 6. Funcionalidades pendientes

**Necesitan backend** (propuesta: Lovable Cloud/Supabase + Twilio y/o Meta WhatsApp Cloud API):
1. **WhatsApp Business y SMS reales**: hoy son demo; los mensajes "enviados" no salen del teléfono.
2. **Cuentas**: login por teléfono con código SMS, respaldo en la nube y sincronización entre dispositivos (hoy, si se borra el navegador, se pierde todo).
3. **Automatizaciones con la app cerrada** (cron): vencimientos, mensaje puente, recordatorios 24 h.
4. **Tope de $4 y validación de precio en el servidor**: hoy se comprueban en el teléfono y se pueden saltar borrando datos.
5. Texto automático a **llamadas perdidas**.
6. **Notas de voz de WhatsApp**: transcribir y traducir.
7. **Cobro de la suscripción** de $10/mes (Stripe u otro).

**Perfil público con página propia** (propuesta de Pepa Crespo, 14/10/2026): hoy hay solo la versión sin backend (QR a WhatsApp + volante PDF). Cuando haya cuentas y base de datos:
- guardar `PublicProfile` (`src/lib/public-profile.ts`) en el servidor con un `slug` permanente y servirlo en `/p/<slug>`;
- **QR y volante ya apuntan a la página** (`/p/<slug>?src=qr|flyer`) cuando el usuario publicó, usando la dirección donde corre la app (`publicBase()` en `public-profile.ts`; nunca localhost). Antes de publicar abren WhatsApp. **Pendiente:** al tener dominio propio, definir `VITE_PUBLIC_PROFILE_URL`; los QR ya impresos con la dirección vieja dejarían de servir, así que fijar el dominio antes de imprimir en serio;
- formulario "Request a quote" público → cotización en la app; traducir el perfil una vez al guardar, no en cada visita.
No hecho a propósito: tarjeta NFC, pase de Wallet, galería de fotos, licencia.

**Sin backend**
8. **Usuarios nuevos empiezan con datos de demo** (`demoState()`: John Smith, etc.). Antes de producción conviene un estado vacío con un "ver demo" opcional.
9. Palabras clave del motor pensadas para **jardinería**. Faltan otros oficios (limpieza de casas, plomería, pintura…) o que se generen desde los servicios del usuario.
10. "Mantener precio" (DecisionSheet) cotiza sin pedir dirección si no la tiene.
11. Pantalla legada `mensaje.$clientId.tsx` y el tipo `Message`: unificarlas con las conversaciones.
12. Widget nativo (no es posible en web; hay accesos directos en el manifiesto).

---

## 7. Errores y riesgos conocidos

- **Texto obsoleto** en `src/lib/ai/ask.ts`, dentro de `translate()`: al llegar al tope dice "Conecta tu IA en **Más → Tu IA**…". Esa ruta ya no existe (ahora es Configuración → Avanzado). Corregirlo con el mismo texto que usa `ask()`.
- **Sin verificar en producción** (no había claves aquí):
  - que `/v1/chat/completions` responda con los modelos Gemini (último cambio, ver §10);
  - la traducción automática de mensajes entrantes;
  - la lectura de recibos por el gateway (imagen como `image_url` con data URL);
  - las llamadas BYOK reales;
  - micrófono, voz y GPS en teléfonos reales;
  - el aspecto visual de los PDF (factura y resumen).
- **jsPDF usa Helvetica (WinAnsi)**: los emojis y algunos símbolos no se ven en los PDF (`safe()` solo reemplaza guiones).
- **Millas** en línea recta (el GPS del navegador no sigue con la pantalla bloqueada); el usuario puede corregirlas.
- **Lint**: 0 errores y 20 avisos (`react-refresh/only-export-components`, inofensivos).
- **Solo en dev**: tras la recarga en caliente de `marcelo-store.tsx` aparece "useMarcelo must be used inside MarceloProvider". Se arregla recargando la página; no afecta a producción.
- La **detección de idioma** (`detectLang`, `guessLang`) es heurística y puede fallar en mensajes muy cortos.
- **Precios** en `ai/config.ts` (`GATEWAY_PRICES`): **Gemini 3.8 Flash duplica su precio el 1 de enero de 2027** ($1.50/$7.50). Actualizar la tabla y revisar `TYPICAL_TURN_USD`.

---

## 8. Decisiones importantes (y por qué)

- **Respuestas automáticas sin IA** (reglas en `marcelo-autopilot.ts`): predecibles y gratis. Nunca inventan precios ni horarios y nunca cortan por el tope. La IA solo se usa para el asistente de voz, las traducciones y los recibos.
- **Blindaje del asistente**: lista cerrada de 11 acciones (zod). Toda escritura pide Confirmar y una acción inválida se descarta con un mensaje neutro. La IA no puede tocar la app, la configuración, las conexiones ni las claves. Los datos del usuario van entre `<datos>` y el prompt indica que son información, no órdenes.
- **Precios**: Marcelo **nunca** cambia un precio ni da descuentos solo. Un descuento siempre es una acción explícita del usuario (`conv.price`). `applyResult` bloquea cualquier cotización con precio distinto al de la tabla.
- **Escribir a mano pausa a Marcelo** en ese chat, también con trabajos agendados. "Reactivar Marcelo" lo vuelve a encender.
- **Mover trabajos**: Marcelo los mueve solo si el hueco está libre (con margen, horario y días bloqueados). Si el usuario lleva el chat, nada se mueve sin su toque.
- **Mensajes salientes** de trabajos: un toque la primera vez, con la opción "siempre automático" por tipo.
- **Un solo tope de $4/mes** para toda la IA incluida (decisión del usuario). Si hay IA propia, es ilimitada.
- **Modelos**: Gemini 3.8 Flash para el asistente y 3.1 Flash-Lite para traducir y leer recibos. **Ningún modelo premium como respaldo.** Contexto: con `/v1/responses` cada turno caía en GPT-6 Astra a ~0.04–0.05 créditos (1 crédito = $1).
- **BYOK desde el navegador**: la clave no pasa por el servidor de Marcelo y se guarda aparte del resto de los datos.
- **Glosario y estilo**: español neutro, frases de menos de 12 palabras, texto de 16 px mínimo, zonas táctiles de 48 px, sistema de diseño en blanco, gris cálido, mandarina y grafito (fuente Plus Jakarta Sans, ver `AGENTS.md`). No rediseñar lo que no se pide.
- **Git/Lovable**: no reescribir el historial publicado (no force-push). El flujo usado: trabajar en la rama `pulir-mvp`, subirla, PR a `main`, merge y Publish en Lovable.

---

## 9. Credenciales y configuración (NO exponer)

- **`LOVABLE_API_KEY`**: variable de entorno del servidor (la inyecta Lovable). La usa `src/lib/marcelo.functions.ts`. **Nunca** debe aparecer en el código, en el cliente ni en logs.
- **Claves de IA propias de cada usuario**: solo en su `localStorage` (`marcelo.ai.own.v1`). Nunca se envían al servidor de Marcelo, nunca se registran en logs y no salen en "Exportar mis datos".
- **`VITE_DEMO_MODE`**: opcional. Con `"false"` se apaga el modo demo; ponerlo así solo cuando haya canales reales.
- Futuras: credenciales de Twilio y Meta WhatsApp, y Supabase. Deben ir como secretos del servidor, nunca con el prefijo `VITE_` (eso las expone en el navegador).
- Este repositorio **no contiene** claves ni secretos.

---

## 10. Exactamente dónde quedó el trabajo

**Último cambio** (commit `a6a39f4`, unido en el PR #6, merge `f7d8a01`):
- `src/lib/marcelo.functions.ts` pasó de `POST /v1/responses` (solo admite OpenAI: con Gemini devolvía `400 model_not_responses` y cada turno caía en `openai/gpt-6-astra`) a **`POST https://ai.gateway.lovable.dev/v1/chat/completions`**:
  - formato OpenAI (`messages`, `max_tokens`);
  - cabeceras `Authorization: Bearer` y `Lovable-API-Key`;
  - imagen como `{type:"image_url", image_url:{url:dataURL}}`;
  - lee `choices[0].message.content` y `usage.prompt_tokens / completion_tokens`;
  - timeout de 30 s.
- Modelos por tarea en la constante `MODELS`. **GPT-6 Astra quitado.**
- `src/lib/ai/config.ts`: precio de Flash-Lite añadido y `TYPICAL_TURN_USD = 0.002`.

**Lo que tocaba hacer después:**
1. **Verificar en producción** (lo hace el usuario con Lovable). Publicar, usar el asistente y traducir un mensaje, y pedir a Lovable los logs del gateway. Hay que ver:
   - `google/gemini-3.8-flash` en el asistente;
   - `google/gemini-3.1-flash-lite` en las traducciones y recibos;
   - menos de 0.002 créditos por turno;
   - **sin** la línea `answered by backup`.
2. Si aparece un 400 con Gemini en `/v1/chat/completions`, revisar en los logs qué parámetro rechaza (por ejemplo `max_tokens`) y ajustarlo en `callGateway`.
3. Corregir el texto obsoleto de `translate()` en `ai/ask.ts` (ver §7).
4. Siguiente gran bloque propuesto: **backend** (Lovable Cloud + Twilio/WhatsApp) para canales reales, cuentas, automatizaciones con la app cerrada y el tope en el servidor (§6).

---

## 11. Cómo trabajar en el proyecto

```bash
bun install            # o npm install
bun run dev            # http://localhost:5173 (sin LOVABLE_API_KEY la IA incluida responde "no está conectado")
npx tsc --noEmit       # tipos
bun run lint           # 0 errores esperados
bun run build          # regenera src/routeTree.gen.ts y compila
npx prettier --write src
```
- Rutas nuevas: crear el archivo en `src/routes/`. `routeTree.gen.ts` se regenera con dev/build (no se edita a mano).
- Para probar como usuario ya registrado, en la consola del navegador:
  `localStorage.setItem("marcelo.state.v1", JSON.stringify({profile:{name:"Carlos Ramírez",trade:"Jardinería",city:"Pasadena, CA",onboarded:true}})); location.reload()`. `migrate()` rellena el resto con la demo.
- Para probar los mensajes entrantes: Mensajes → **Simular mensaje**. En un chat, "Escribir como: [cliente] (demo)".
- El motor se puede probar sin navegador importando `marcelo-autopilot.ts`, `marcelo-ops.ts` y `demoState()` desde un script con `bun run`.
