import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Keyboard,
  Loader2,
  MessageSquareText,
  Mic,
  Repeat,
  Save,
  Send,
  Smartphone,
  Square,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Sheet } from "@/components/marcelo/kit";
import { useMarcelo } from "@/lib/marcelo-store";
import { translate } from "@/lib/ai/ask";
import { todayISO, uid } from "@/lib/marcelo-data";
import {
  canDictate,
  guessLang,
  dictate,
  speak,
  stopSpeaking,
  unlockSpeech,
  type Lang,
  type SpeechRecognitionLike,
} from "@/lib/speech";
import { cn } from "@/lib/utils";
import character from "@/assets/marcelo-character.png";

export const Route = createFileRoute("/traducir")({
  validateSearch: (search: Record<string, unknown>): { clientId?: string } =>
    typeof search["clientId"] === "string" ? { clientId: search["clientId"] } : {},
  head: () => ({
    meta: [
      { title: "Traducir con tu cliente — Marcelo" },
      {
        name: "description",
        content:
          "Tú hablas español, tu cliente habla inglés. Marcelo traduce en voz alta al momento.",
      },
    ],
  }),
  component: Traducir,
});

type Side = "user" | "client";
type Turn = { id: string; from: Side; original: string; translated: string; pending: boolean };

const langOf: Record<Side, Lang> = { user: "es", client: "en" };

/** One-tap phrases with a fixed translation: instant and free. */
const QUICK: [string, string][] = [
  ["Ya terminé", "I'm all done."],
  ["¿Dónde dejo el material?", "Where should I leave the materials?"],
  ["Pago por Zelle o efectivo", "You can pay by Zelle or cash."],
  ["Llego en 10 minutos", "I'll be there in 10 minutes."],
  ["¿Puedo usar su llave de agua?", "May I use your water spigot?"],
  ["¿Puede mover su carro, por favor?", "Could you please move your car?"],
  ["¿Le gusta cómo quedó?", "Are you happy with how it looks?"],
  ["Vuelvo la próxima semana", "I'll be back next week."],
  ["¿Tiene alguna pregunta?", "Do you have any questions?"],
  ["Gracias por su confianza", "Thank you for trusting us."],
];
const other = (s: Side): Side => (s === "user" ? "client" : "user");

const copy = {
  user: {
    who: "Tú · Español",
    tap: "Toca y habla en español",
    listening: "Te escucho…",
    translating: "Traduciendo…",
    empty: "Toca el micrófono y habla en español. Marcelo se lo dice a tu cliente en inglés.",
    youSaid: "Tú dijiste",
    type: "Escribir",
    placeholder: "Escribe en español",
  },
  client: {
    who: "Customer · English",
    tap: "Tap and speak English",
    listening: "Listening…",
    translating: "Translating…",
    empty: "Tap the mic and speak in English. Marcelo will translate to Spanish out loud.",
    youSaid: "You said",
    type: "Type",
    placeholder: "Type in English",
  },
} as const;

/** Texts around the big phrases: each screen speaks to whoever is holding the phone. */
const ui = {
  user: {
    live: "En vivo · Español ↔ English",
    pill: "Tú hablas · Español",
    says: "Marcelo lo dice en inglés",
    incoming: "Tu cliente dijo",
    yourTurn: "Toca el micrófono y responde",
    replay: "Repetir en voz alta",
    pass: "Pasar al cliente",
    hint: "Cuando termines, pasa el teléfono al cliente.",
    voice: "Voz",
    continuous: "Continuo",
    right: "¿Correcto?",
    yes: "Sí",
    fix: "Corregir",
  },
  client: {
    live: "Live · Español ↔ English",
    pill: "Client speaks · English",
    says: "Marcelo lo dice en español",
    incoming: "Your contractor said",
    yourTurn: "Tap the mic and answer",
    replay: "Repeat out loud",
    pass: "Pass it back",
    hint: "When you finish, pass the phone back.",
    voice: "Sound",
    continuous: "Auto",
    right: "Is this right?",
    yes: "Yes",
    fix: "Fix",
  },
} as const;

function Traducir() {
  const { clientId } = Route.useSearch();
  const { state, addMessage } = useMarcelo();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState<Side | null>(null);
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState<Side | null>(null);
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState(true);
  const [active, setActive] = useState<Side>("user");
  const [phrases, setPhrases] = useState(false);
  const [options, setOptions] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const continuousRef = useRef(false);
  continuousRef.current = continuous;
  const [saving, setSaving] = useState(false);
  const [saveTo, setSaveTo] = useState(clientId ?? "");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  const client = state.clients.find((c) => c.id === (saveTo || clientId));
  const busy = turns.some((t) => t.pending);

  useEffect(
    () => () => {
      recRef.current?.stop();
      stopSpeaking();
    },
    [],
  );

  const handleText = async (tappedSide: Side, raw: string, preset?: string) => {
    const text = raw.trim();
    if (!text) return;
    // Whoever tapped, the language decides who is talking (the phone may be passed around).
    const guessed = guessLang(text);
    const side: Side = guessed ? (guessed === "es" ? "user" : "client") : tappedSide;
    const id = uid();
    const recent = turnsRef.current
      .filter((t) => !t.pending)
      .slice(-4)
      .map((t) => ({ from: t.from, text: t.original }));
    if (preset) {
      setTurns((ts) => [
        ...ts,
        { id, from: side, original: text, translated: preset, pending: false },
      ]);
      afterTranslation(side, preset);
      return;
    }
    setTurns((ts) => [...ts, { id, from: side, original: text, translated: "", pending: true }]);
    const res = await translate({
      text,
      to: langOf[other(side)],
      trade: state.profile.trade,
      recent,
    });
    if (!res.ok) {
      setTurns((ts) => ts.filter((t) => t.id !== id));
      // Give the text back so nothing has to be said or typed twice.
      setTyping(side);
      setDraft(text);
      toast.error(res.reply);
      return;
    }
    setTurns((ts) =>
      ts.map((t) => (t.id === id ? { ...t, translated: res.text, pending: false } : t)),
    );
    afterTranslation(side, res.text);
  };

  /** Speaks the translation; in continuous mode, then listens to the other person. */
  const afterTranslation = (side: Side, translated: string) => {
    const next = () => {
      if (continuousRef.current) toggleMic(other(side));
    };
    if (voice) speak(translated, langOf[other(side)], next);
    else next();
  };

  const toggleMic = (side: Side) => {
    setActive(side); // continuous mode hands the mic over: the screen follows it
    unlockSpeech();
    stopSpeaking();
    if (listening) {
      recRef.current?.stop();
      setListening(null);
      if (listening === side) return;
    }
    if (!canDictate()) {
      setTyping(side);
      toast.info("Este navegador no permite dictado. Escribe el mensaje.");
      return;
    }
    setInterim("");
    setTyping(null);
    const rec = dictate(langOf[side], {
      onText: setInterim,
      onFinal: (t) => {
        setListening(null);
        setInterim("");
        void handleText(side, t);
      },
      onError: () => {
        setListening(null);
        toast.error(
          side === "user"
            ? "No te escuché bien. Intenta de nuevo."
            : "Didn't catch that. Try again.",
        );
      },
      onEnd: () => setListening(null),
    });
    recRef.current = rec;
    setListening(side);
  };

  const save = () => {
    const target = state.clients.find((c) => c.id === saveTo);
    if (!target) return;
    const done = turns.filter((t) => !t.pending);
    for (const t of done) {
      addMessage({
        clientId: target.id,
        es: t.from === "user" ? t.original : t.translated,
        en: t.from === "user" ? t.translated : t.original,
        date: todayISO(),
      });
    }
    setSaving(false);
    toast.success(`Conversación guardada con ${target.name}`);
  };

  // One full screen, one person at a time: the phone is passed between the worker and the client,
  // and the screen changes (color, language, buttons) to whoever holds it.
  const side = active;
  const isUser = side === "user";
  const c = copy[side];
  const t2 = ui[side];
  const lastTurn = turns[turns.length - 1];
  const mine = [...turns].reverse().find((t) => t.from === side);
  const isListening = listening === side;
  const spokeLast = Boolean(lastTurn && lastTurn.from === side);
  const incoming = lastTurn && lastTurn.from !== side ? lastTurn : undefined;
  const hasDone = turns.some((t) => !t.pending);

  const bigTop = isListening
    ? interim || c.listening
    : spokeLast
      ? lastTurn!.original
      : incoming && !incoming.pending
        ? incoming.translated
        : "";
  const topLabel = isListening ? null : incoming && !spokeLast ? t2.incoming : null;
  const bottomText = spokeLast && !isListening ? lastTurn!.translated : "";
  const bottomPending = spokeLast && !isListening && lastTurn!.pending;
  const replay = () => {
    unlockSpeech();
    if (spokeLast && lastTurn && !lastTurn.pending) speak(lastTurn.translated, langOf[other(side)]);
    else if (incoming && !incoming.pending) speak(incoming.translated, langOf[side]);
  };
  const canReplay = Boolean(
    (spokeLast && lastTurn && !lastTurn.pending && !isListening) ||
    (incoming && !incoming.pending && !isListening),
  );

  const pass = () => {
    recRef.current?.stop();
    setListening(null);
    stopSpeaking();
    setTyping(null);
    setActive(other(side));
  };

  const bars = [6, 8, 12, 18, 30, 44, 30, 22, 34, 50, 62, 50, 34, 22, 30, 44, 30, 18, 12, 8, 6];

  return (
    <div
      key={side}
      className={cn(
        "relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white transition-colors duration-300",
        "bg-primary",
      )}
    >
      <header className="flex shrink-0 items-start justify-between">
        <button
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          aria-label="Cerrar"
          className="flex size-11 items-center justify-center rounded-full text-white/90"
        >
          <X className="size-7" />
        </button>
        <div className="pt-1 text-center">
          <p className="text-[28px] font-extrabold leading-none tracking-tight">Marcelo</p>
          {client ? <p className="mt-1 text-[12px] text-white/60">{client.name}</p> : null}
        </div>
        <img src={character} alt="" aria-hidden className="size-14 object-contain" />
      </header>

      <button
        onClick={() => setOptions(true)}
        aria-label="Opciones de la conversación"
        className={cn(
          "mx-auto mt-1 flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold transition-colors",
          isUser ? "bg-white/12" : "bg-green-500",
        )}
      >
        <span
          className={cn("size-3 rounded-full bg-green-300", isListening && "animate-pulse")}
          aria-hidden
        />
        {t2.live}
        <ChevronDown className="size-4 opacity-70" />
      </button>

      <main className="mt-3 flex min-h-0 flex-1 flex-col items-center text-center">
        <span
          className={cn(
            "shrink-0 rounded-full px-5 py-2 text-[15px] font-extrabold uppercase tracking-wide",
            isUser ? "bg-peach text-accent" : "bg-white/18 text-white",
          )}
        >
          {topLabel ?? (isUser ? t2.pill : `🇺🇸 ${t2.pill}`)}
        </span>

        <div className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto">
          <div className="my-auto flex w-full flex-col items-center gap-3 py-2">
            {bigTop ? (
              <p
                className={cn(
                  "w-full break-words font-extrabold leading-[1.08] tracking-tight",
                  bigTop.length > 60
                    ? "text-[28px]"
                    : bigTop.length > 28
                      ? "text-[34px]"
                      : "text-[42px]",
                  isListening && "text-white/80",
                )}
              >
                {bigTop}
              </p>
            ) : (
              <p className="mx-auto max-w-[300px] text-[20px] font-semibold leading-snug text-white/80">
                {c.empty}
              </p>
            )}

            <div
              className="flex h-[60px] shrink-0 items-center justify-center gap-[5px]"
              aria-hidden
            >
              {bars.map((h, i) => (
                <span
                  key={i}
                  style={{
                    height: isListening ? `${h}px` : `${Math.max(5, h * 0.5)}px`,
                    animationDelay: `${(i % 7) * 90}ms`,
                  }}
                  className={cn(
                    "w-[4px] origin-center rounded-full bg-white/70",
                    isListening && "animate-wave bg-white",
                    !isListening && i % 2 === 0 && "opacity-60",
                  )}
                />
              ))}
            </div>

            {(spokeLast || incoming) && !isListening ? (
              <>
                <div className="flex w-full items-center gap-3 text-[13px] font-semibold uppercase tracking-wide text-white/70">
                  <span className="h-px flex-1 bg-white/25" />
                  {spokeLast ? t2.says : t2.yourTurn}
                  <span className="h-px flex-1 bg-white/25" />
                </div>
                {spokeLast ? (
                  bottomPending ? (
                    <p className="flex items-center gap-2 text-[22px] text-white/80">
                      <Loader2 className="size-6 animate-spin" /> {c.translating}
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "w-full break-words font-extrabold leading-[1.08] tracking-tight",
                        bottomText.length > 60
                          ? "text-[28px]"
                          : bottomText.length > 28
                            ? "text-[34px]"
                            : "text-[42px]",
                      )}
                    >
                      {bottomText}
                    </p>
                  )
                ) : null}
              </>
            ) : null}

            {spokeLast &&
            mine &&
            !mine.pending &&
            !isListening &&
            figures(mine.translated).length &&
            !checked.includes(mine.id) ? (
              <div className="w-full rounded-2xl bg-white/12 p-3 text-left">
                <p className="text-[15px] font-semibold">
                  {t2.right}{" "}
                  {figures(mine.translated).map((f) => (
                    <mark key={f} className="mx-0.5 rounded bg-accent px-1.5 text-white">
                      {f}
                    </mark>
                  ))}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setChecked((cc) => [...cc, mine.id])}
                    className="h-11 rounded-full bg-white text-[15px] font-bold text-primary"
                  >
                    {t2.yes}
                  </button>
                  <button
                    onClick={() => {
                      setTurns((ts) => ts.filter((t) => t.id !== mine.id));
                      setTyping(side);
                      setDraft(mine.original);
                    }}
                    className="h-11 rounded-full border-2 border-white/60 text-[15px] font-bold"
                  >
                    {t2.fix}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {canReplay ? (
          <button
            onClick={replay}
            className="mt-1 flex shrink-0 flex-col items-center gap-1.5"
            aria-label={t2.replay}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-lift)]">
              <Volume2 className="size-7" />
            </span>
            <span className="text-[15px] font-bold">{t2.replay}</span>
          </button>
        ) : null}
      </main>

      {typing === side ? (
        <form
          className="relative mt-3 shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            unlockSpeech();
            void handleText(side, draft);
            setDraft("");
            setTyping(null);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={c.placeholder}
            className="h-14 w-full rounded-full border-0 bg-white pl-5 pr-14 text-[17px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!draft.trim()}
            className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </form>
      ) : (
        <div className="mt-3 grid shrink-0 grid-cols-[1fr_auto] items-end gap-3">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => toggleMic(side)}
              disabled={busy && !isListening}
              aria-label={c.tap}
              className={cn(
                "relative flex size-[104px] items-center justify-center rounded-full text-white shadow-[0_12px_30px_-6px_rgba(0,0,0,0.45)] transition-transform active:scale-95 disabled:opacity-50",
                "bg-accent",
              )}
            >
              {isListening ? (
                <>
                  <span
                    className={cn("absolute inset-0 animate-ping rounded-full", "bg-accent/50")}
                  />
                  <Square className="relative size-10 fill-current" />
                </>
              ) : (
                <Mic className="size-12" strokeWidth={1.8} />
              )}
            </button>
            <span className="max-w-[190px] text-center text-[16px] font-bold leading-tight">
              {isListening ? c.listening : c.tap}
            </span>
          </div>
          <div className="flex w-[104px] flex-col items-center gap-2">
            <button
              onClick={pass}
              aria-label={t2.pass}
              className="flex size-[84px] items-center justify-center rounded-full border-2 border-white/40 text-white transition-transform active:scale-95"
            >
              <Smartphone className="size-9" strokeWidth={1.6} />
            </button>
            <span className="text-center text-[14px] font-bold leading-tight">{t2.pass}</span>
          </div>
        </div>
      )}
      <p className="mt-2 shrink-0 text-center text-[13px] text-white/60">{t2.hint}</p>

      {options ? (
        <Sheet title="Opciones" onClose={() => setOptions(false)}>
          <div className="divide-y divide-border rounded-2xl border text-foreground">
            <OptionToggle
              label="Voz alta"
              hint="Marcelo dice la traducción en voz alta"
              on={voice}
              onChange={setVoice}
            />
            <OptionToggle
              label="Modo continuo"
              hint="El micrófono pasa solo al otro lado"
              on={continuous}
              onChange={(v) => {
                setContinuous(v);
                toast(
                  v
                    ? "Modo continuo: el micrófono pasa solo al otro lado"
                    : "Modo continuo apagado",
                );
              }}
            />
            <OptionRow
              icon={<Zap className="size-5" />}
              label="Frases rápidas"
              hint="Traducción instantánea"
              onClick={() => {
                setOptions(false);
                setActive("user");
                setPhrases(true);
              }}
            />
            <OptionRow
              icon={<Keyboard className="size-5" />}
              label={isUser ? "Escribir en lugar de hablar" : "Type instead of speaking"}
              onClick={() => {
                setOptions(false);
                setTyping(side);
                setDraft("");
              }}
            />
            <OptionRow
              icon={<Save className="size-5" />}
              label="Guardar la conversación"
              hint={hasDone ? "En la ficha de un cliente" : "Cuando haya una frase traducida"}
              dim={!hasDone}
              onClick={() => {
                setOptions(false);
                if (hasDone) setSaving(true);
                else toast.info("Podrás guardar cuando haya al menos una frase traducida.");
              }}
            />
          </div>
        </Sheet>
      ) : null}

      {phrases ? (
        <Sheet
          title="Frases rápidas"
          icon={<Zap className="size-5 text-accent" />}
          onClose={() => setPhrases(false)}
        >
          <div className="space-y-2">
            {QUICK.map(([es, en]) => (
              <button
                key={es}
                onClick={() => {
                  setPhrases(false);
                  unlockSpeech();
                  void handleText("user", es, en);
                }}
                className="flex min-h-14 w-full flex-col items-start justify-center rounded-2xl border border-border bg-card px-4 py-2 text-left"
              >
                <span className="text-[16px] font-semibold">{es}</span>
                <span className="text-[13px] text-muted-foreground">{en}</span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}

      {saving ? (
        <Sheet
          title="Guardar conversación"
          icon={<MessageSquareText className="size-5 text-accent" />}
          onClose={() => setSaving(false)}
        >
          <p className="-mt-2 text-[13px] text-muted-foreground">
            Queda en la ficha del cliente, en español y en inglés.
          </p>
          <div className="mt-4 space-y-2 rounded-2xl bg-muted/50 p-3 text-foreground">
            {turns
              .filter((t) => !t.pending)
              .map((t) => (
                <div
                  key={t.id}
                  className={cn("text-[13px]", t.from === "user" ? "text-right" : "text-left")}
                >
                  <p className="font-semibold">{t.original}</p>
                  <p className="text-muted-foreground">{t.translated}</p>
                </div>
              ))}
          </div>
          <label className="mt-4 block text-foreground">
            <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Cliente
            </span>
            <select
              value={saveTo}
              onChange={(e) => setSaveTo(e.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[15px] outline-none focus:border-accent"
            >
              <option value="">Elige un cliente</option>
              {state.clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSaving(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={!saveTo}>
              Guardar
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function OptionToggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className="block text-[13px] text-muted-foreground">{hint}</span>
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-muted-foreground/25",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-6 rounded-full bg-card shadow transition-all",
            on ? "left-7" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  hint,
  onClick,
  dim,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left",
        dim && "opacity-50",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        {hint ? <span className="block text-[13px] text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

/** Numbers that must survive translation intact: prices, times, dates, quantities. */
function figures(text: string) {
  return [
    ...new Set(
      text.match(
        /\$\s?\d[\d,.]*|\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)|\b\d{1,2}:\d{2}\b|\b\d+(?:[.,]\d+)?\b/gi,
      ) ?? [],
    ),
  ].slice(0, 4);
}
