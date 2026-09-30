/**
 * Marcelo's auto-reply for client conversations (WhatsApp / SMS), plus the client messages
 * tied to a job (confirmation, reminder, on the way, invoice).
 *
 * Deterministic on purpose: it quotes only the user's own prices, asks for address and size
 * before quoting, offers only free slots inside working hours, and books only after the client
 * explicitly accepts. Client text is untrusted input: it is only pattern-matched, never executed
 * or passed to a model here. Anything it can't handle safely (discounts, complaints, photos,
 * odd requests) is handed back to the user as "tu_turno".
 */
import {
  isActiveJob,
  money,
  prettyDate,
  prettyDateEn,
  prettyTime,
  priceFor,
  priceRange,
  sizeLabel,
  todayISO,
  zipOf,
  type Conversation,
  type Job,
  type MarceloState,
  type Service,
  type ServiceKind,
  type Size,
} from "./marcelo-data";

type Reply = { text: string; es?: string | undefined };
type Slot = { date: string; time: string };

export type AutopilotResult = {
  /** Spanish summary of what the client said, shown under their bubble. */
  clientNote?: string | undefined;
  reply?: Reply | undefined;
  patch: Partial<Conversation>;
  /** Create or move the quote job for this conversation. */
  quote?: { service: Service; price: number; size?: Size | undefined; slot: Slot } | undefined;
  /** The client accepted the current quote. */
  confirm?: boolean | undefined;
  /** The client declined; cancel the quote job. */
  cancel?: boolean | undefined;
  saveAddress?: string | undefined;
  pending?: { text: string } | undefined;
  /** Move an already booked job (the client asked and the new time is free). */
  move?: { jobId: string; date: string; time: string } | undefined;
  event?: "quoted" | "booked" | "handoff" | "declined" | "asked" | "moved" | undefined;
};

export const QUOTE_TTL_MS = 48 * 3_600_000;
export const BRIDGE_AFTER_MS = 15 * 60_000;

const kindKeywords: Record<ServiceKind, string[]> = {
  pasto: ["mow", "mowing", "lawn", "grass", "pasto", "cesped", "cortar", "corte"],
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
    "arbustos",
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
  ],
  reparacion: ["fix", "repair", "broken", "leak", "arreglar", "reparar", "roto"],
  general: ["maintenance", "general", "mantenimiento"],
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
const ADDRESS = /^\s*\d{1,6}\s+[a-z0-9 .'-]{3,}/i;
const MOVE =
  /\b(reschedul\w*|re-schedul\w*|move (it|the)|change (the )?(day|date|time)|postpone|push it|another day|can'?t make it|won'?t be (home|there)|have to leave|cambiar|mover|moverlo|reprogram\w*|posponer|pasarlo|no puedo|no voy a estar)\b/;
const SAME_TIME = /\b(same time|misma hora)\b/;

const sizeWords: [RegExp, Size][] = [
  [/\b(small|tiny|little|chico|chica|pequen[oa])\b/, "chico"],
  [/\b(medium|mid|average|regular|mediano|mediana|normal)\b/, "mediano"],
  [/\b(large|big|huge|grande|enorme)\b/, "grande"],
];

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

// Words that show up in almost any yard request and say nothing about which service it is.
const GENERIC = new Set(["yard", "garden", "jardin", "service", "servicio", "general", "care"]);

function scoreServices(text: string, services: Service[]) {
  const t = norm(text);
  return services
    .map((s) => {
      const words = new Set(
        [
          ...kindKeywords[s.kind],
          ...norm(`${s.name} ${s.nameEn}`)
            .split(/[^a-z]+/)
            .filter((w) => w.length > 3),
        ]
          .map(norm)
          .filter((w) => !GENERIC.has(w)),
      );
      // Prefix match so "trimmed" counts for "trim" and "cleaned" for "clean".
      const hits = [...words].filter((w) =>
        new RegExp(`\\b${w}${w.length >= 4 ? "\\w*" : "\\b"}`).test(t),
      );
      // "hedge" and "hedges" hitting the same word count once.
      const score = new Set(hits.map((w) => w.slice(0, 5))).size;
      const kindHit = kindKeywords[s.kind].some(
        (w) => !GENERIC.has(w) && new RegExp(`\\b${norm(w)}`).test(t),
      );
      return { s, score, kindHit };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function matchService(text: string, services: Service[]): Service | undefined {
  return scoreServices(text, services)[0]?.s;
}

/**
 * Services that fit about equally well, or two services joined with "and / y / también":
 * more than one means Marcelo should ask instead of guessing.
 */
function candidatesFor(text: string, services: Service[]) {
  const t = norm(text);
  // The client wrote the service's own name ("poda y limpieza"): no doubt.
  const byName = services.find((s) => t.includes(norm(s.name)));
  if (byName) return [byName];
  const scored = scoreServices(text, services);
  const top = scored[0];
  if (!top) return [];
  const joined = /\b(and|also|plus|y|tambien|ademas)\b/.test(t);
  return scored
    .filter(
      (x, i) =>
        i === 0 ||
        (x.score === top.score && x.kindHit) ||
        (joined && x.kindHit && x.s.kind !== top.s.kind),
    )
    .map((x) => x.s);
}

function sizeFrom(t: string): Size | undefined {
  return sizeWords.find(([re]) => re.test(t))?.[1];
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

/** Exact "HH:mm" when the client gave one ("at 10 am", "a las 3:30"). */
function preferredTime(t: string): string | undefined {
  const m =
    t.match(
      /\b(?:at|a las|around|como a las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/,
    ) ?? t.match(/\b(?:at|a las)\s+(\d{1,2})(?::(\d{2}))?\b/);
  const h = preferredHour(t);
  if (!m || h === undefined) return undefined;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

/**
 * A new day/time mentioned in a message, relative to the job it's about:
 * "tomorrow at the same time", "Friday at 10 am", "mañana a la misma hora".
 */
export function parseWhen(text: string, base: { date: string; time: string }) {
  const t = norm(text);
  const day = preferredDay(t);
  const time = SAME_TIME.test(t) ? base.time : preferredTime(t);
  if (!day && !time) return null;
  return { date: day ?? base.date, time: time ?? base.time };
}

/** Why a job can't go at that date/time (in Spanish), or [] when it fits. */
export function conflictsFor(state: MarceloState, job: Job, date: string, time: string): string[] {
  const out: string[] = [];
  const dow = new Date(`${date}T12:00:00`).getDay();
  const day = state.settings.hours[dow];
  const minutes =
    state.services.find((s) => s.id === job.serviceId || s.name === job.service)?.minutes ?? 90;
  const start = toMin(time);
  if (new Date(`${date}T${time}:00`).getTime() < Date.now()) out.push("Esa hora ya pasó");
  if (state.settings.blocked.includes(date)) out.push("Bloqueaste ese día");
  else if (!day?.on) out.push("Ese día no trabajas");
  else if (start < toMin(day.start) || start + minutes > toMin(day.end)) {
    out.push(`Fuera de tu horario (${prettyTime(day.start)}–${prettyTime(day.end)})`);
  }
  for (const other of state.jobs) {
    if (other.id === job.id || other.date !== date || !isActiveJob(other)) continue;
    const oStart = toMin(other.time);
    const oEnd =
      oStart +
      (state.services.find((s) => s.id === other.serviceId || s.name === other.service)?.minutes ??
        90);
    const buffer = state.settings.bufferMin;
    if (start < oEnd + buffer && start + minutes + buffer > oStart) {
      const who = state.clients.find((c) => c.id === other.clientId)?.name ?? "otro cliente";
      out.push(`Choca con ${who} a las ${prettyTime(other.time)}`);
    }
  }
  return out;
}

/** The booked job a conversation is about: its own, or the client's next one. */
export function jobForConversation(state: MarceloState, conv: Conversation): Job | undefined {
  const own = state.jobs.find((j) => j.id === conv.jobId && isActiveJob(j));
  if (own) return own;
  return state.jobs
    .filter((j) => j.clientId === conv.clientId && isActiveJob(j) && j.date >= todayISO())
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
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

/**
 * First free slot inside that day's working hours. Without a specific day it prefers a day
 * when the user is already working near the same ZIP code, so the route stays tight.
 */
export function findSlot(
  state: MarceloState,
  minutes: number,
  opts: {
    day?: string | undefined;
    hour?: number | undefined;
    after?: Slot | undefined;
    /** Conversation asking; its own pending offer doesn't block it. */
    conversationId?: string | undefined;
    /** A job being moved doesn't block its own new slot. */
    excludeJobId?: string | undefined;
    zip?: string | undefined;
  } = {},
): Slot | undefined {
  const { hours, blocked, bufferMin } = state.settings;
  const durationOf = (j: Job) =>
    state.services.find((s) => s.id === j.serviceId || s.name === j.service)?.minutes ?? 90;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const clientZip = (j: Job) =>
    zipOf(j.address ?? state.clients.find((c) => c.id === j.clientId)?.address);

  const firstSlotOn = (i: number): Slot | undefined => {
    const date = todayISO(i);
    const day = hours[new Date(`${date}T12:00:00`).getDay()];
    if (!day?.on || blocked.includes(date)) return undefined;
    if (opts.after && date < opts.after.date) return undefined;
    const busy = state.jobs
      .filter(
        (j) =>
          j.date === date &&
          isActiveJob(j) &&
          j.id !== opts.excludeJobId &&
          (j.status !== "cotizado" || j.conversationId !== opts.conversationId),
      )
      .map((j) => [toMin(j.time), toMin(j.time) + durationOf(j)] as const);
    const candidates: number[] = [];
    for (let start = toMin(day.start); start + minutes <= toMin(day.end); start += 60)
      candidates.push(start);
    if (opts.hour !== undefined) {
      const h = opts.hour * 60;
      candidates.sort((a, b) => Math.abs(a - h) - Math.abs(b - h));
    }
    for (const start of candidates) {
      if (i === 0 && start < nowMin + 120) continue; // never offer something in the next two hours
      if (opts.after && date === opts.after.date && start <= toMin(opts.after.time)) continue;
      const end = start + minutes;
      if (busy.some(([b, e]) => start < e + bufferMin && end + bufferMin > b)) continue;
      return { date, time: toHHMM(start) };
    }
    return undefined;
  };

  if (opts.day) {
    for (let i = 0; i <= 21; i++) if (todayISO(i) === opts.day) return firstSlotOn(i);
    return undefined;
  }
  const slots: Slot[] = [];
  for (let i = 0; i <= 21 && slots.length < 8; i++) {
    const s = firstSlotOn(i);
    if (s) slots.push(s);
  }
  if (opts.zip) {
    // Within the first week, a day already booked near the same ZIP wins.
    const near = slots.find(
      (s) =>
        s.date <= todayISO(7) &&
        state.jobs.some((j) => j.date === s.date && isActiveJob(j) && clientZip(j) === opts.zip),
    );
    if (near) return near;
  }
  return slots[0];
}

const say = (lang: "en" | "es", en: string, es: string): Reply =>
  lang === "en" ? { text: en, es } : { text: es };

const serviceList = (services: Service[], lang: "en" | "es") =>
  services
    .map((s) => {
      const r = priceRange(s);
      const p = r ? `${money(r[0])}–${money(r[1])}` : money(s.price);
      return `• ${lang === "en" ? s.nameEn : s.name}: ${p}`;
    })
    .join("\n");

const firstName = (c: Conversation) => c.contactName.split(" ")[0] ?? "";

/** Price Marcelo is allowed to quote: the price table, unless the user explicitly set one. */
export const allowedPrice = (conv: Conversation, service: Service, size?: Size) =>
  conv.price ?? priceFor(service, size ?? conv.size);

export function quote(
  conv: Conversation,
  service: Service,
  slot: Slot | undefined,
  lang: "en" | "es",
  intro: { en: string; es: string },
  price: number,
  size?: Size,
): AutopilotResult {
  const first = firstName(conv);
  const sizeEn = size && service.sizes ? ` for a ${sizeLabel[size].en} yard` : "";
  const sizeEs = size && service.sizes ? ` para un jardín ${sizeLabel[size].es.toLowerCase()}` : "";
  if (!slot) {
    return {
      reply: say(
        lang,
        `${intro.en} ${service.nameEn}${sizeEn} is ${money(price)}. My schedule is full for the next few weeks — I'll text you as soon as a spot opens.`,
        `${intro.es} ${service.name}${sizeEs} cuesta ${money(price)}. Tengo la agenda llena las próximas semanas; te escribo apenas se abra un espacio.`,
      ),
      patch: {
        stage: "tu_turno",
        serviceId: service.id,
        size,
        proposal: undefined,
        awaiting: undefined,
      },
      pending: { text: `Buscar espacio para ${first} (${service.name})` },
      event: "handoff",
    };
  }
  return {
    reply: say(
      lang,
      `${intro.en} ${service.nameEn}${sizeEn} is ${money(price)}. I can come ${prettyDateEn(slot.date)} at ${prettyTime(slot.time)}. Does that work for you? Reply YES to book it.`,
      `${intro.es} ${service.name}${sizeEs} cuesta ${money(price)}. Puedo ir ${prettyDate(slot.date).toLowerCase()} a las ${prettyTime(slot.time)}. ¿Te sirve? Responde SÍ para agendar.`,
    ),
    patch: {
      stage: "cotizado",
      serviceId: service.id,
      size,
      proposal: slot,
      awaiting: undefined,
      candidates: undefined,
    },
    quote: { service, price, size, slot },
    event: "quoted",
  };
}

/**
 * With a service picked, asks for whatever is missing (address, then size) and quotes once
 * Marcelo has it all.
 */
function nextStep(
  state: MarceloState,
  conv: Conversation,
  service: Service,
  lang: "en" | "es",
  prefs: { day?: string | undefined; hour?: number | undefined },
  intro: { en: string; es: string },
): AutopilotResult {
  const first = firstName(conv);
  const client = state.clients.find((c) => c.id === conv.clientId);
  const address = conv.address ?? (client?.address || undefined);
  if (!address) {
    return {
      reply: say(
        lang,
        `${intro.en} I can help with ${service.nameEn.toLowerCase()}. What's the address, including the ZIP code?`,
        `${intro.es} Te ayudo con ${service.name.toLowerCase()}. ¿Cuál es la dirección, con código postal?`,
      ),
      patch: {
        serviceId: service.id,
        awaiting: "address",
        stage: "nuevo",
        candidates: undefined,
        prefer: prefs,
      },
      event: "asked",
    };
  }
  if (service.sizes && !conv.size && conv.price === undefined) {
    const r = priceRange(service)!;
    return {
      reply: say(
        lang,
        `Thanks ${first}! Is the yard small, medium or large? You can also send a photo. Prices run ${money(r[0])}–${money(r[1])}.`,
        `¡Gracias ${first}! ¿El jardín es chico, mediano o grande? También puedes mandar una foto. El precio va de ${money(r[0])} a ${money(r[1])}.`,
      ),
      patch: {
        serviceId: service.id,
        address,
        awaiting: "size",
        stage: "nuevo",
        candidates: undefined,
      },
      event: "asked",
    };
  }
  const slot = findSlot(state, service.minutes, {
    ...prefs,
    conversationId: conv.id,
    zip: zipOf(address),
  });
  const res = quote(conv, service, slot, lang, intro, allowedPrice(conv, service), conv.size);
  res.patch.address = address;
  res.patch.prefer = undefined;
  return res;
}

export function runAutopilot(
  state: MarceloState,
  conv: Conversation,
  raw: string,
  opts: { photo?: boolean | undefined } = {},
): AutopilotResult {
  const t = norm(raw);
  // The first message decides the language of the conversation.
  const lang =
    conv.messages.filter((m) => m.from === "client").length > 1 ? conv.lang : detectLang(raw);
  const first = firstName(conv);
  const owner = state.profile.name.split(" ")[0] || (lang === "en" ? "the owner" : "el dueño");
  const service = state.services.find((s) => s.id === conv.serviceId);
  const candidates = candidatesFor(raw, state.services);
  const mentioned = candidates[0];
  const exactHour = preferredHour(t);
  // What the client asked for earlier ("this Saturday morning") still counts after we ask for the address.
  const day = preferredDay(t) ?? conv.prefer?.day;
  const hour = exactHour ?? vagueHour(t) ?? conv.prefer?.hour;
  const hi = { en: `Hi ${first}!`, es: `¡Hola ${first}!` };
  const thanks = { en: `Thanks ${first}!`, es: `¡Gracias ${first}!` };

  const handoff = (note: string, pendingText: string, custom?: Reply): AutopilotResult => ({
    clientNote: note,
    reply:
      custom ??
      say(
        lang,
        `Thanks ${first}! Let me check with ${owner} and I'll get back to you shortly.`,
        `¡Gracias ${first}! Déjame consultarlo con ${owner} y te respondo pronto.`,
      ),
    patch: { stage: "tu_turno", lang },
    pending: { text: pendingText },
    event: "handoff",
  });

  // A photo: Marcelo can't judge size from it, so it gives the range and passes it to the user.
  if (opts.photo) {
    const target = service ?? mentioned;
    const r = target ? priceRange(target) : null;
    return handoff(
      "Mandó una foto",
      `Ver la foto de ${first} y confirmar precio`,
      target && r
        ? say(
            lang,
            `Thanks for the photo, ${first}! ${target.nameEn} usually runs ${money(r[0])}–${money(r[1])}. ${owner} will confirm the exact price shortly.`,
            `¡Gracias por la foto, ${first}! ${target.name} suele costar entre ${money(r[0])} y ${money(r[1])}. ${owner} te confirma el precio exacto pronto.`,
          )
        : undefined,
    );
  }

  // Price negotiation always goes to the user: Marcelo never changes a price on its own.
  if (has(t, PRICE_PUSHBACK)) {
    const target = mentioned ?? service;
    const res = handoff(
      "Pidió descuento",
      `${first} pidió descuento${target ? ` en ${target.name.toLowerCase()}` : ""}`,
    );
    if (target) {
      const p = allowedPrice(conv, target);
      res.reply = say(
        lang,
        `Thanks ${first}! My regular price for ${target.nameEn.toLowerCase()} is ${money(p)}. Let me check with ${owner} and I'll get back to you shortly.`,
        `¡Gracias ${first}! Mi precio normal por ${target.name.toLowerCase()} es ${money(p)}. Déjame consultarlo con ${owner} y te respondo pronto.`,
      );
      res.patch.serviceId = target.id;
    }
    return res;
  }

  // Waiting on something Marcelo asked for.
  if (conv.awaiting === "service") {
    const pick =
      candidates.length === 1
        ? mentioned
        : state.services.find((s) => conv.candidates?.includes(s.id) && candidates.includes(s));
    if (pick) {
      const res = nextStep(
        state,
        { ...conv, candidates: undefined },
        pick,
        lang,
        { day, hour },
        thanks,
      );
      res.clientNote = `Eligió: ${pick.name}`;
      return res;
    }
  }
  if (conv.awaiting === "address" && service) {
    if (ADDRESS.test(raw)) {
      const address = raw.trim().slice(0, 160);
      const res = nextStep(state, { ...conv, address }, service, lang, { day, hour }, thanks);
      res.clientNote = "Mandó su dirección";
      res.patch.address = address;
      return res;
    }
  }
  if (conv.awaiting === "size" && service) {
    const size = sizeFrom(t);
    if (size) {
      const res = nextStep(state, { ...conv, size }, service, lang, { day, hour }, thanks);
      res.clientNote = `Tamaño: ${sizeLabel[size].es}`;
      res.patch.size = size;
      return res;
    }
  }

  if (conv.stage === "cotizado" && service && conv.proposal) {
    if (has(t, DECLINE)) {
      return {
        clientNote: "No aceptó",
        reply: say(
          lang,
          `No problem, ${first}. Text me anytime if you need anything!`,
          `No hay problema, ${first}. Escríbeme cuando necesites algo.`,
        ),
        patch: { stage: "rechazado", proposal: undefined },
        cancel: true,
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
        allowedPrice(conv, service),
        conv.size,
      );
      res.clientNote = "Quiere otro horario";
      return res;
    }
    if (has(t, ACCEPT)) {
      const price = allowedPrice(conv, service);
      const client = state.clients.find((c) => c.id === conv.clientId);
      const needsAddress = !conv.address && !client?.address;
      const when = `${prettyDateEn(conv.proposal.date)} at ${prettyTime(conv.proposal.time)}`;
      const cuando = `${prettyDate(conv.proposal.date).toLowerCase()} a las ${prettyTime(conv.proposal.time)}`;
      return {
        clientNote: `Aceptó ${money(price)}`,
        reply: say(
          lang,
          `You're booked! ${service.nameEn} for ${money(price)}, ${when}.${needsAddress ? " What's the address?" : " See you then!"}`,
          `¡Listo, quedó agendado! ${service.name} por ${money(price)}, ${cuando}.${needsAddress ? " ¿Cuál es la dirección?" : " ¡Nos vemos!"}`,
        ),
        patch: { stage: "agendado" },
        confirm: true,
        event: "booked",
      };
    }
    if (mentioned && mentioned.id !== service.id) {
      const res = nextStep(
        state,
        { ...conv, size: undefined, price: undefined },
        mentioned,
        lang,
        { day, hour },
        { en: "Sure!", es: "¡Claro!" },
      );
      res.clientNote = `Pide: ${mentioned.name}`;
      return res;
    }
    return handoff("Pregunta algo más", `Responder a ${first}`);
  }

  if (conv.stage === "agendado") {
    const moved = reschedule(state, conv, raw, lang);
    if (moved) return moved;
    const client = state.clients.find((c) => c.id === conv.clientId);
    if (client && !client.address && ADDRESS.test(raw)) {
      return {
        clientNote: "Mandó su dirección",
        saveAddress: raw.trim().slice(0, 160),
        reply: say(lang, `Got it, thank you! See you then.`, `¡Perfecto, gracias! Nos vemos.`),
        patch: {},
      };
    }
    if (has(t, DECLINE)) return handoff("Quiere cancelar", `${first} quiere cancelar el trabajo`);
    if (/\b(thanks|thank you|gracias|great|perfect|perfecto|ok)\b/.test(t) && t.length < 40) {
      return { clientNote: "Dio las gracias", patch: {} };
    }
    if (!mentioned) return handoff("Pregunta algo más", `Responder a ${first}`);
  }

  // New request (or a new one after a previous job / decline).
  if (candidates.length > 1) {
    const [a, b] = candidates;
    return {
      clientNote: `Dudoso: ${a!.name} o ${b!.name}`,
      reply: say(
        lang,
        `${hi.en} Just to be sure: do you need ${a!.nameEn.toLowerCase()} or ${b!.nameEn.toLowerCase()}?`,
        `${hi.es} Para estar seguro: ¿necesitas ${a!.name.toLowerCase()} o ${b!.name.toLowerCase()}?`,
      ),
      patch: { awaiting: "service", candidates: candidates.map((c) => c.id), stage: "nuevo", lang },
      event: "asked",
    };
  }
  if (mentioned) {
    const size = sizeFrom(t);
    const address = ADDRESS.test(raw)
      ? raw.match(/\d{1,6}\s+[^,.!?]+(,\s*\d{5})?/)?.[0]
      : undefined;
    const res = nextStep(
      state,
      { ...conv, size: size ?? conv.size, address: address ?? conv.address },
      mentioned,
      lang,
      { day, hour },
      hi,
    );
    res.clientNote = `Pide: ${mentioned.name}`;
    res.patch.lang = lang;
    if (size) res.patch.size = size;
    if (address) res.patch.address = address;
    return res;
  }
  if (has(t, ASK_PRICE) || has(t, GREETING) || conv.stage === "nuevo") {
    return {
      clientNote: has(t, ASK_PRICE) ? "Pregunta precios" : "Saludo",
      reply: say(
        lang,
        `Hi ${first}! Thanks for reaching out. These are my services:\n${serviceList(state.services, "en")}\nWhich one do you need?`,
        `¡Hola ${first}! Gracias por escribir. Estos son mis servicios:\n${serviceList(state.services, "es")}\n¿Cuál necesitas?`,
      ),
      patch: { stage: "nuevo", lang },
    };
  }
  return handoff("No entendí el pedido", `Responder a ${first}`);
}

/* ——— One-tap decisions for "Te necesita" ——— */

/** Keep the list price and re-offer a slot. */
export function holdPrice(state: MarceloState, conv: Conversation, service: Service) {
  const first = firstName(conv);
  const slot = findSlot(state, service.minutes, {
    conversationId: conv.id,
    zip: zipOf(conv.address),
  });
  const price = priceFor(service, conv.size);
  return quote(
    { ...conv, price: undefined },
    service,
    slot,
    conv.lang,
    {
      en: `Thanks for waiting, ${first}! My best price is firm:`,
      es: `¡Gracias por esperar, ${first}! Mi mejor precio es fijo:`,
    },
    price,
    conv.size,
  );
}

/** The user chose a custom price (discount): Marcelo re-quotes with it. */
export function offerPrice(
  state: MarceloState,
  conv: Conversation,
  service: Service,
  price: number,
) {
  const slot =
    conv.proposal && conv.proposal.date > todayISO()
      ? conv.proposal
      : findSlot(state, service.minutes, { conversationId: conv.id, zip: zipOf(conv.address) });
  const first = firstName(conv);
  const res = quote(
    conv,
    service,
    slot,
    conv.lang,
    { en: `Good news, ${first}!`, es: `¡Buenas noticias, ${first}!` },
    price,
    conv.size,
  );
  res.patch.price = price;
  return res;
}

export const discountPrice = (price: number, pct: number) =>
  Math.max(5, Math.round((price * (1 - pct)) / 5) * 5);

export function declineConv(conv: Conversation): AutopilotResult {
  const first = firstName(conv);
  return {
    reply: say(
      conv.lang,
      `Thanks for thinking of us, ${first}. Unfortunately we can't take this one. Wishing you the best!`,
      `Gracias por pensar en nosotros, ${first}. Esta vez no podemos tomar el trabajo. ¡Que te vaya muy bien!`,
    ),
    patch: { stage: "rechazado", proposal: undefined },
    cancel: true,
    event: "declined",
  };
}

/** "Te respondo hoy mismo": sent 15 minutes after a handoff the user hasn't answered. */
export function bridgeMessage(conv: Conversation): Reply {
  const first = firstName(conv);
  return say(
    conv.lang,
    `Hi ${first}, I haven't forgotten you — I'll get back to you today.`,
    `Hola ${first}, no me olvidé de ti: te respondo hoy mismo.`,
  );
}

/** The offered time passed or 48 h went by: one friendly follow-up with a fresh slot. */
export function followup(state: MarceloState, conv: Conversation, service: Service) {
  const first = firstName(conv);
  const slot = findSlot(state, service.minutes, {
    conversationId: conv.id,
    zip: zipOf(conv.address),
  });
  return quote(
    conv,
    service,
    slot,
    conv.lang,
    {
      en: `Hi ${first}, the time I offered has passed, but I'd still love to help.`,
      es: `Hola ${first}, el horario que te ofrecí ya pasó, pero con gusto te ayudo.`,
    },
    allowedPrice(conv, service),
    conv.size,
  );
}

/** The user tapped "¿No es esto?" and picked the right service. */
export function requote(state: MarceloState, conv: Conversation, service: Service) {
  return nextStep(
    state,
    { ...conv, size: undefined, price: undefined },
    service,
    conv.lang,
    {},
    {
      en: "Sorry for the mix-up!",
      es: "¡Perdona la confusión!",
    },
  );
}

/* ——— Messages tied to a job ——— */

export function jobMessage(
  kind: "confirm" | "reminder" | "onTheWay" | "invoice",
  job: Job,
  lang: "en" | "es",
  extra: {
    clientName: string;
    service?: Service | undefined;
    eta?: number | undefined;
    instructions?: string;
  },
): Reply {
  const first = extra.clientName.split(" ")[0] ?? "";
  const svcEn = extra.service?.nameEn ?? job.service;
  const svcEs = job.service;
  const when = `${prettyDateEn(job.date)} at ${prettyTime(job.time)}`;
  const cuando = `${prettyDate(job.date).toLowerCase()} a las ${prettyTime(job.time)}`;
  switch (kind) {
    case "confirm":
      return say(
        lang,
        `Hi ${first}! You're confirmed: ${svcEn} ${when}, ${money(job.price)}. Reply here if anything changes.`,
        `¡Hola ${first}! Quedó confirmado: ${svcEs} ${cuando}, ${money(job.price)}. Escríbeme si algo cambia.`,
      );
    case "reminder":
      return say(
        lang,
        `Hi ${first}, friendly reminder: I'll be there ${when} for ${svcEn.toLowerCase()}. See you!`,
        `Hola ${first}, te recuerdo que voy ${cuando} para ${svcEs.toLowerCase()}. ¡Nos vemos!`,
      );
    case "onTheWay":
      return say(
        lang,
        `Hi ${first}, I'm on my way${extra.eta ? ` — about ${extra.eta} minutes` : ""}.`,
        `Hola ${first}, voy en camino${extra.eta ? `, llego en unos ${extra.eta} minutos` : ""}.`,
      );
    case "invoice":
      return say(
        lang,
        `Hi ${first}, thanks for your business! Invoice for ${svcEn.toLowerCase()} on ${prettyDateEn(job.date)}: ${money(job.price)}.${extra.instructions ? ` You can pay by ${extra.instructions}.` : ""}`,
        `Hola ${first}, ¡gracias por tu confianza! Factura por ${svcEs.toLowerCase()} del ${prettyDate(job.date).toLowerCase()}: ${money(job.price)}.${extra.instructions ? ` Puedes pagar por ${extra.instructions}.` : ""}`,
      );
  }
}

/**
 * A booked client asks to change day/time. Free slot → move it and confirm. Taken → offer the
 * closest free time that day (or the next free one) and wait for a yes. Nothing to parse → ask.
 */
function reschedule(
  state: MarceloState,
  conv: Conversation,
  raw: string,
  lang: "en" | "es",
): AutopilotResult | undefined {
  const job = jobForConversation(state, conv);
  if (!job) return undefined;
  const t = norm(raw);
  const first = firstName(conv);
  const service = state.services.find((s) => s.id === job.serviceId || s.name === job.service);
  const svcEn = (service?.nameEn ?? job.service).toLowerCase();
  const svcEs = job.service.toLowerCase();
  const pending = conv.pendingMove?.jobId === job.id ? conv.pendingMove : undefined;
  const asksMove = has(t, MOVE);

  const doMove = (date: string, time: string, note: string): AutopilotResult => ({
    clientNote: note,
    reply: say(
      lang,
      `Done, ${first}! I moved your ${svcEn} to ${prettyDateEn(date)} at ${prettyTime(time)}. See you then!`,
      `¡Listo, ${first}! Moví tu ${svcEs} para ${prettyDate(date).toLowerCase()} a las ${prettyTime(time)}. ¡Nos vemos!`,
    ),
    patch: { pendingMove: undefined },
    move: { jobId: job.id, date, time },
    event: "moved",
  });

  // The client is answering our offer of a new time.
  if (pending?.date && pending.time) {
    if (has(t, ACCEPT) && !has(t, DECLINE))
      return doMove(pending.date, pending.time, "Aceptó el nuevo horario");
  }

  const when = parseWhen(raw, job);
  if (!asksMove && !pending) {
    // Mentions a different day/time without asking: only act when it's clearly a change.
    // "OK, see you tomorrow at 10" with a different time is a change, not just an "ok".
    if (!when || (when.date === job.date && when.time === job.time)) return undefined;
  }
  if (!when) {
    return {
      clientNote: "Quiere cambiar el horario",
      reply: say(
        lang,
        `No problem, ${first}! What day and time work better for you?`,
        `¡No hay problema, ${first}! ¿Qué día y hora te quedan mejor?`,
      ),
      patch: { pendingMove: { jobId: job.id } },
      event: "asked",
    };
  }
  if (when.date === job.date && when.time === job.time) return undefined;

  const problems = conflictsFor(state, job, when.date, when.time);
  const note = `Quiere mover a ${prettyDate(when.date).toLowerCase()}, ${prettyTime(when.time)}`;
  if (!problems.length) return doMove(when.date, when.time, note);

  const minutes = service?.minutes ?? 90;
  const alt =
    findSlot(state, minutes, {
      day: when.date,
      hour: toMin(when.time) / 60,
      excludeJobId: job.id,
      conversationId: conv.id,
    }) ??
    findSlot(state, minutes, {
      after: { date: when.date, time: when.time },
      excludeJobId: job.id,
      conversationId: conv.id,
    });
  if (!alt) {
    return {
      clientNote: note,
      reply: say(
        lang,
        `Thanks ${first}! That time is taken. Let me check my schedule and I'll get back to you shortly.`,
        `¡Gracias ${first}! Esa hora está ocupada. Reviso mi agenda y te respondo pronto.`,
      ),
      patch: { stage: "tu_turno", pendingMove: undefined },
      pending: { text: `Buscar otro horario para ${first}` },
      event: "handoff",
    };
  }
  return {
    clientNote: note,
    reply: say(
      lang,
      `Sorry ${first}, ${prettyDateEn(when.date)} at ${prettyTime(when.time)} is taken. I can do ${prettyDateEn(alt.date)} at ${prettyTime(alt.time)}. Does that work? Reply YES.`,
      `Perdona ${first}, ${prettyDate(when.date).toLowerCase()} a las ${prettyTime(when.time)} está ocupado. Puedo ${prettyDate(alt.date).toLowerCase()} a las ${prettyTime(alt.time)}. ¿Te sirve? Responde SÍ.`,
    ),
    patch: { pendingMove: { jobId: job.id, date: alt.date, time: alt.time } },
    event: "asked",
  };
}

/**
 * A new day/time agreed in the chat (even when the user is answering by hand) that differs
 * from the booked job: shown as "¿Mover el trabajo…?" with any conflicts. Null when nothing changed.
 */
export function suggestedMove(state: MarceloState, conv: Conversation) {
  const job = jobForConversation(state, conv);
  if (!job) return null;
  // While Marcelo is negotiating the new time itself, its offer is not an agreement yet.
  const userInCharge =
    conv.stage === "manual" || conv.stage === "tu_turno" || !state.settings.autoReply;
  if (conv.pendingMove && !userInCharge) return null;
  const said = conv.messages.filter((m) => m.from !== "marcelo");
  for (const m of said.reverse().slice(0, 3)) {
    const text = m.from === "client" ? m.text : `${m.text} ${m.es ?? ""}`;
    const when = parseWhen(text, job);
    if (!when) continue;
    if (when.date === job.date && when.time === job.time) return null;
    const key = `${job.id}:${when.date}:${when.time}`;
    if (conv.dismissedMove === key) return null;
    return {
      job,
      date: when.date,
      time: when.time,
      key,
      conflicts: conflictsFor(state, job, when.date, when.time),
    };
  }
  return null;
}
