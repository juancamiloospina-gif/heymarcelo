/**
 * Marcelo's auto-reply for client conversations (WhatsApp / SMS).
 *
 * Deterministic on purpose: it quotes only the user's own prices, offers only free
 * slots inside working hours, and books only after the client explicitly accepts.
 * Anything it can't handle safely (discounts, complaints, odd requests) is handed
 * back to the user as "tu_turno".
 */
import {
  money,
  prettyDate,
  prettyDateEn,
  prettyTime,
  todayISO,
  type Conversation,
  type MarceloState,
  type Service,
  type ServiceKind,
} from "./marcelo-data";

export type AutopilotResult = {
  /** Spanish summary of what the client said, shown under their bubble. */
  clientNote?: string | undefined;
  reply?: { text: string; es?: string | undefined };
  patch: Partial<Conversation>;
  book?: { service: Service; price: number; date: string; time: string };
  saveAddress?: string;
  pending?: { text: string; amount?: number | undefined };
  event?: "quoted" | "booked" | "handoff" | "declined";
};

const kindKeywords: Record<ServiceKind, string[]> = {
  pasto: ["mow", "mowing", "lawn", "grass", "pasto", "césped", "cesped", "cortar", "corte"],
  poda: [
    "trim",
    "trimming",
    "prune",
    "pruning",
    "hedge",
    "hedges",
    "bush",
    "bushes",
    "tree",
    "trees",
    "poda",
    "podar",
    "arbusto",
    "árbol",
    "arbol",
  ],
  limpieza: [
    "cleanup",
    "clean",
    "leaves",
    "leaf",
    "yard",
    "debris",
    "limpieza",
    "limpiar",
    "hojas",
  ],
  riego: [
    "sprinkler",
    "sprinklers",
    "irrigation",
    "drip",
    "watering",
    "riego",
    "aspersor",
    "aspersores",
  ],
  plantas: [
    "plant",
    "plants",
    "planting",
    "flowers",
    "garden",
    "sod",
    "plantar",
    "plantas",
    "flores",
    "jardín",
  ],
  reparacion: ["fix", "repair", "broken", "leak", "arreglar", "reparar", "roto"],
  general: ["maintenance", "general", "service", "mantenimiento"],
};

const has = (text: string, re: RegExp) => re.test(text);
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const SPANISH =
  /\b(hola|buenas|quiero|necesito|cuanto|precio|puede|podria|gracias|jardin|pasto|limpieza|poda|usted|mi casa|por favor)\b/;
const ACCEPT =
  /\b(yes|yeah|yep|yup|ok|okay|sure|sounds good|deal|book it|perfect|great|confirm|confirmed|works for me|that works|let'?s do it|si|dale|perfecto|de acuerdo|esta bien|claro|listo|va|me sirve|agendalo)\b/;
const PRICE_PUSHBACK =
  /(too (much|expensive|high)|cheaper|discount|lower|less than|best price|could you do \$?\d+|can you do \$?\d+|expensive|caro|descuento|rebaja|mas barato|por menos|me lo deja en)/;
const DECLINE =
  /\b(no thanks|no thank you|not now|not interested|cancel|never ?mind|no gracias|ya no|cancelar|no me interesa)\b|^no\b/;
const RESCHEDULE =
  /\b(another|other|different|later|earlier|next week|otro dia|otra hora|otro horario|mas tarde|mas temprano|la otra semana)\b/;
const ASK_PRICE =
  /\b(how much|price|prices|quote|rates?|cost|cuanto|precio|precios|cotizacion|cobra)\b/;
const GREETING = /\b(hi|hello|hey|good (morning|afternoon)|hola|buenas|buenos dias)\b/;

const weekdayWords: [RegExp, number][] = [
  [/\b(sunday|domingo)\b/, 0],
  [/\b(monday|lunes)\b/, 1],
  [/\b(tuesday|martes)\b/, 2],
  [/\b(wednesday|miercoles)\b/, 3],
  [/\b(thursday|jueves)\b/, 4],
  [/\b(friday|viernes)\b/, 5],
  [/\b(saturday|sabado)\b/, 6],
];

export function detectLang(text: string): "en" | "es" {
  return SPANISH.test(norm(text)) ? "es" : "en";
}

export function matchService(text: string, services: Service[]): Service | undefined {
  const t = norm(text);
  let best: { s: Service; score: number } | undefined;
  for (const s of services) {
    const words = [
      ...kindKeywords[s.kind],
      ...norm(`${s.name} ${s.nameEn}`)
        .split(/[^a-z]+/)
        .filter((w) => w.length > 3),
    ];
    const score = words.reduce(
      (acc, w) => acc + (new RegExp(`\\b${norm(w)}\\b`).test(t) ? 1 : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best?.s;
}

function preferredDay(t: string): string | undefined {
  // "mañana" is "tomorrow", but "la mañana" is "the morning".
  if (/\btomorrow\b/.test(t) || (/\bmanana\b/.test(t) && !/\b(la|las) manana\b/.test(t)))
    return todayISO(1);
  if (/\b(today|hoy)\b/.test(t)) return todayISO();
  for (const [re, dow] of weekdayWords) {
    if (re.test(t)) {
      for (let i = 1; i <= 7; i++) {
        if (new Date(`${todayISO(i)}T12:00:00`).getDay() === dow) return todayISO(i);
      }
    }
  }
  return undefined;
}

function preferredHour(t: string): number | undefined {
  const m =
    t.match(
      /\b(?:at|a las|around|como a las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/,
    ) ?? t.match(/\b(?:at|a las)\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const suffix = m[3]?.replace(/\./g, "");
  if (suffix === "pm" && h < 12) h += 12;
  if (suffix === "am" && h === 12) h = 0;
  // "a las 3" without am/pm during working hours almost always means the afternoon.
  if (!suffix && h >= 1 && h <= 6) h += 12;
  return h >= 0 && h <= 23 ? h : undefined;
}

/** "in the morning" / "en la tarde": a preference, not a request to move an offered slot. */
function vagueHour(t: string): number | undefined {
  if (/\b(morning|la manana|temprano)\b/.test(t)) return 9;
  if (/\b(afternoon|la tarde)\b/.test(t)) return 14;
  return undefined;
}

const toMin = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** First free slot inside working hours, optionally on a given day / hour / after a given slot. */
export function findSlot(
  state: MarceloState,
  minutes: number,
  opts: {
    day?: string | undefined;
    hour?: number | undefined;
    after?: { date: string; time: string } | undefined;
    /** Conversation asking; its own pending offer doesn't block it. */
    conversationId?: string | undefined;
  } = {},
): { date: string; time: string } | undefined {
  const { workDays, workStart, workEnd } = state.settings;
  const durationOf = (service: string) =>
    state.services.find((s) => s.name === service)?.minutes ?? 90;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  for (let i = 0; i <= 21; i++) {
    const date = todayISO(i);
    if (opts.day && date !== opts.day) continue;
    if (opts.after && date < opts.after.date) continue;
    if (!workDays.includes(new Date(`${date}T12:00:00`).getDay())) continue;

    // Booked jobs plus slots already offered to other clients who haven't answered yet.
    const busy = [
      ...state.jobs
        .filter((j) => j.date === date)
        .map((j) => [toMin(j.time), toMin(j.time) + durationOf(j.service)] as const),
      ...state.conversations
        .filter(
          (c) =>
            c.id !== opts.conversationId && c.stage === "cotizado" && c.proposal?.date === date,
        )
        .map((c) => {
          const start = toMin(c.proposal!.time);
          const svc = state.services.find((s) => s.id === c.serviceId);
          return [start, start + (svc?.minutes ?? 90)] as const;
        }),
    ];

    const candidates: number[] = [];
    for (let start = toMin(workStart); start + minutes <= toMin(workEnd); start += 60)
      candidates.push(start);
    if (opts.hour !== undefined)
      candidates.sort((a, b) => Math.abs(a - opts.hour! * 60) - Math.abs(b - opts.hour! * 60));

    for (const start of candidates) {
      if (i === 0 && start < nowMin + 120) continue; // never offer something in the next two hours
      if (opts.after && date === opts.after.date && start <= toMin(opts.after.time)) continue;
      const end = start + minutes + 30; // 30 min to drive between jobs
      if (busy.some(([b, e]) => start < e + 30 && end > b)) continue;
      return { date, time: toHHMM(start) };
    }
  }
  return undefined;
}

const serviceList = (services: Service[], lang: "en" | "es") =>
  services.map((s) => `• ${lang === "en" ? s.nameEn : s.name}: ${money(s.price)}`).join("\n");

export function quote(
  conv: Conversation,
  service: Service,
  slot: { date: string; time: string } | undefined,
  lang: "en" | "es",
  intro: { en: string; es: string },
  price = service.price,
): AutopilotResult {
  const first = conv.contactName.split(" ")[0] ?? "";
  const override = price === service.price ? undefined : price;
  if (!slot) {
    return {
      reply: {
        text:
          lang === "en"
            ? `${intro.en} ${service.nameEn} is ${money(price)}. My schedule is full for the next few weeks — I'll text you as soon as a spot opens.`
            : `${intro.es} ${service.name} cuesta ${money(price)}. Tengo la agenda llena las próximas semanas; te escribo apenas se abra un espacio.`,
        es:
          lang === "en"
            ? `${intro.es} ${service.name} cuesta ${money(price)}. No tengo espacio pronto; te aviso apenas se abra uno.`
            : undefined,
      },
      patch: { stage: "tu_turno", serviceId: service.id, price: override, proposal: undefined },
      pending: { text: `Buscar espacio para ${first} (${service.name})` },
      event: "handoff",
    };
  }
  const en = `${intro.en} ${service.nameEn} is ${money(price)}. I can come ${prettyDateEn(slot.date)} at ${prettyTime(slot.time)}. Does that work for you? Reply YES to book it.`;
  const es = `${intro.es} ${service.name} cuesta ${money(price)}. Puedo ir ${prettyDate(slot.date).toLowerCase()} a las ${prettyTime(slot.time)}. ¿Te sirve? Responde SÍ para agendar.`;
  return {
    reply: lang === "en" ? { text: en, es } : { text: es },
    patch: { stage: "cotizado", serviceId: service.id, price: override, proposal: slot },
    event: "quoted",
  };
}

export function runAutopilot(
  state: MarceloState,
  conv: Conversation,
  raw: string,
): AutopilotResult {
  const t = norm(raw);
  // The first message decides the language of the conversation.
  const lang =
    conv.messages.filter((m) => m.from === "client").length > 1 ? conv.lang : detectLang(raw);
  const first = conv.contactName.split(" ")[0] ?? "";
  const owner = state.profile.name.split(" ")[0] || (lang === "en" ? "the owner" : "el dueño");
  const service = state.services.find((s) => s.id === conv.serviceId);
  const mentioned = matchService(raw, state.services);
  const day = preferredDay(t);
  const exactHour = preferredHour(t);
  const hour = exactHour ?? vagueHour(t);
  const hi = { en: `Hi ${first}!`, es: `¡Hola ${first}!` };

  const handoff = (note: string, pendingText: string): AutopilotResult => ({
    clientNote: note,
    reply: {
      text:
        lang === "en"
          ? `Thanks ${first}! Let me check with ${owner} and I'll get back to you shortly.`
          : `¡Gracias ${first}! Déjame consultarlo con ${owner} y te respondo pronto.`,
      es:
        lang === "en"
          ? `¡Gracias ${first}! Déjame consultarlo con ${owner} y te respondo pronto.`
          : undefined,
    },
    patch: { stage: "tu_turno", lang },
    pending: { text: pendingText },
    event: "handoff",
  });

  // Price negotiation always goes to the user: Marcelo never changes a price on its own.
  if (has(t, PRICE_PUSHBACK)) {
    const target = mentioned ?? service;
    const base = target
      ? {
          en: `Thanks ${first}! My regular price for ${target.nameEn.toLowerCase()} is ${money(target.id === service?.id ? (conv.price ?? target.price) : target.price)}. Let me check with ${owner} and I'll get back to you shortly.`,
          es: `¡Gracias ${first}! Mi precio normal por ${target.name.toLowerCase()} es ${money(target.id === service?.id ? (conv.price ?? target.price) : target.price)}. Déjame consultarlo con ${owner} y te respondo pronto.`,
        }
      : null;
    const res = handoff(
      "Pidió descuento",
      `${first} pidió descuento${target ? ` en ${target.name.toLowerCase()}` : ""}`,
    );
    if (base) res.reply = lang === "en" ? { text: base.en, es: base.es } : { text: base.es };
    res.patch.serviceId = target?.id;
    return res;
  }

  if (conv.stage === "cotizado" && service && conv.proposal) {
    if (has(t, DECLINE)) {
      return {
        clientNote: "No aceptó",
        reply: {
          text:
            lang === "en"
              ? `No problem, ${first}. Text me anytime if you need anything!`
              : `No hay problema, ${first}. Escríbeme cuando necesites algo.`,
          es:
            lang === "en"
              ? `No hay problema, ${first}. Escríbeme cuando necesites algo.`
              : undefined,
        },
        patch: { stage: "rechazado", proposal: undefined },
        event: "declined",
      };
    }
    const wantsChange =
      (day !== undefined && day !== conv.proposal.date) ||
      (exactHour !== undefined && exactHour * 60 !== toMin(conv.proposal.time)) ||
      has(t, RESCHEDULE);
    if (wantsChange) {
      const slot = findSlot(
        state,
        service.minutes,
        day || exactHour !== undefined
          ? { day, hour, conversationId: conv.id }
          : { after: conv.proposal, conversationId: conv.id },
      );
      if (!slot)
        return handoff(
          "Quiere otro horario",
          `${first} quiere otro horario para ${service.name.toLowerCase()}`,
        );
      const res = quote(
        conv,
        service,
        slot,
        lang,
        { en: "Sure!", es: "¡Claro!" },
        conv.price ?? service.price,
      );
      res.clientNote = "Quiere otro horario";
      return res;
    }
    if (has(t, ACCEPT)) {
      const price = conv.price ?? service.price;
      const client = state.clients.find((c) => c.id === conv.clientId);
      const needsAddress = !client?.address;
      const when = `${prettyDateEn(conv.proposal.date)} at ${prettyTime(conv.proposal.time)}`;
      const cuando = `${prettyDate(conv.proposal.date).toLowerCase()} a las ${prettyTime(conv.proposal.time)}`;
      const en = `You're booked! ${service.nameEn} for ${money(price)}, ${when}.${needsAddress ? " What's the address?" : " See you then!"}`;
      const es = `¡Listo, quedó agendado! ${service.name} por ${money(price)}, ${cuando}.${needsAddress ? " ¿Cuál es la dirección?" : " ¡Nos vemos!"}`;
      return {
        clientNote: `Aceptó ${money(price)}`,
        reply: lang === "en" ? { text: en, es } : { text: es },
        patch: { stage: "agendado" },
        book: { service, price, date: conv.proposal.date, time: conv.proposal.time },
        event: "booked",
      };
    }
    if (mentioned && mentioned.id !== service.id) {
      const res = quote(
        conv,
        mentioned,
        findSlot(state, mentioned.minutes, { day, hour, conversationId: conv.id }),
        lang,
        {
          en: "Sure!",
          es: "¡Claro!",
        },
      );
      res.clientNote = `Pide: ${mentioned.name}`;
      return res;
    }
    return handoff("Pregunta algo más", `Responder a ${first}`);
  }

  if (conv.stage === "agendado") {
    const client = state.clients.find((c) => c.id === conv.clientId);
    if (client && !client.address && /^\s*\d+\s+\S+/.test(raw)) {
      return {
        clientNote: "Mandó su dirección",
        saveAddress: raw.trim(),
        reply: {
          text:
            lang === "en" ? `Got it, thank you! See you then.` : `¡Perfecto, gracias! Nos vemos.`,
          es: lang === "en" ? "¡Perfecto, gracias! Nos vemos." : undefined,
        },
        patch: {},
      };
    }
    if (has(t, DECLINE)) return handoff("Quiere cancelar", `${first} quiere cancelar la cita`);
    if (/\b(thanks|thank you|gracias|great|perfect|perfecto|ok)\b/.test(t) && t.length < 40) {
      return { clientNote: "Dio las gracias", patch: {} };
    }
    if (!mentioned) return handoff("Pregunta algo más", `Responder a ${first}`);
  }

  // New request (or a new one after a previous booking / decline).
  if (mentioned) {
    const res = quote(
      conv,
      mentioned,
      findSlot(state, mentioned.minutes, { day, hour, conversationId: conv.id }),
      lang,
      hi,
    );
    res.clientNote = `Pide: ${mentioned.name}`;
    res.patch.lang = lang;
    return res;
  }
  if (has(t, ASK_PRICE) || has(t, GREETING) || conv.stage === "nuevo") {
    const en = `Hi ${first}! Thanks for reaching out. These are my services:\n${serviceList(state.services, "en")}\nWhich one do you need?`;
    const es = `¡Hola ${first}! Gracias por escribir. Estos son mis servicios:\n${serviceList(state.services, "es")}\n¿Cuál necesitas?`;
    return {
      clientNote: has(t, ASK_PRICE) ? "Pregunta precios" : "Saludo",
      reply: lang === "en" ? { text: en, es } : { text: es },
      patch: { stage: "nuevo", lang },
    };
  }
  return handoff("No entendí el pedido", `Responder a ${first}`);
}

/** The user sets a custom price for this client; Marcelo re-quotes with the next free slot. */
export function offerPrice(
  state: MarceloState,
  conv: Conversation,
  service: Service,
  price: number,
) {
  const slot =
    conv.proposal && conv.proposal.date > todayISO()
      ? conv.proposal
      : findSlot(state, service.minutes, { conversationId: conv.id });
  const first = conv.contactName.split(" ")[0] ?? "";
  return quote(
    conv,
    service,
    slot,
    conv.lang,
    { en: `Good news, ${first}!`, es: `¡Buenas noticias, ${first}!` },
    price,
  );
}
