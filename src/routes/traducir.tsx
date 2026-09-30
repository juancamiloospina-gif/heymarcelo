import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpDown,
  Keyboard,
  Loader2,
  MessageSquareText,
  Mic,
  Repeat,
  Save,
  Send,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/marcelo/kit";
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
    tap: "Toca y habla",
    listening: "Te escucho…",
    translating: "Traduciendo…",
    empty: "Toca el micrófono y habla en español. Marcelo se lo dice a tu cliente en inglés.",
    youSaid: "Tú dijiste",
    type: "Escribir",
    placeholder: "Escribe en español",
  },
  client: {
    who: "Customer · English",
    tap: "Tap and speak",
    listening: "Listening…",
    translating: "Translating…",
    empty: "Tap the mic and speak in English. Marcelo will translate to Spanish out loud.",
    youSaid: "You said",
    type: "Type",
    placeholder: "Type in English",
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
  const [flip, setFlip] = useState(true);
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

  const half = (side: Side) => {
    const c = copy[side];
    const forMe = [...turns].reverse().find((t) => t.from === other(side));
    const mine = [...turns].reverse().find((t) => t.from === side);
    const isListening = listening === side;
    const myPending = mine?.pending;
    const isUser = side === "user";

    return (
      <section
        className={cn(
          "relative flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4",
          isUser ? "bg-background" : "bg-card",
          !isUser && flip && "rotate-180",
        )}
      >
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-bold",
              isUser ? "bg-accent/12 text-accent" : "bg-sky/12 text-sky",
            )}
          >
            {c.who}
          </span>
          <button
            onClick={() => {
              setTyping(typing === side ? null : side);
              setDraft("");
            }}
            className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground"
          >
            <Keyboard className="size-4" /> {c.type}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-3">
          {isListening ? (
            <p className="text-[22px] font-semibold leading-snug text-muted-foreground">
              {interim || c.listening}
            </p>
          ) : forMe?.pending ? (
            <p className="flex items-center gap-2 text-[18px] text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> {copy[side].translating}
            </p>
          ) : forMe ? (
            <button
              onClick={() => speak(forMe.translated, langOf[side])}
              className="text-left"
              aria-label="Repetir en voz alta"
            >
              <p className="text-[26px] font-bold leading-snug text-foreground">
                {forMe.translated}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                <Volume2 className="size-3.5" /> {isUser ? "Toca para repetir" : "Tap to replay"}
              </p>
            </button>
          ) : !mine ? (
            <p className="max-w-[300px] text-[16px] leading-relaxed text-muted-foreground">
              {c.empty}
            </p>
          ) : null}
          {mine &&
          !mine.pending &&
          !isListening &&
          figures(mine.translated).length &&
          !checked.includes(mine.id) ? (
            <div className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 p-3">
              <p className="text-[14px] font-semibold text-warning-foreground">
                {isUser ? "¿Correcto?" : "Is this right?"}{" "}
                {figures(mine.translated).map((f) => (
                  <mark key={f} className="mx-0.5 rounded bg-warning/40 px-1 text-foreground">
                    {f}
                  </mark>
                ))}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setChecked((c) => [...c, mine.id])}
                >
                  {isUser ? "Sí" : "Yes"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setTurns((ts) => ts.filter((t) => t.id !== mine.id));
                    setTyping(side);
                    setDraft(mine.original);
                  }}
                >
                  {isUser ? "Corregir" : "Fix"}
                </Button>
              </div>
            </div>
          ) : null}
          {mine && !isListening ? (
            <p className="mt-4 line-clamp-2 text-[13px] text-muted-foreground">
              <span className="font-semibold">{c.youSaid}:</span> {mine.original}
              {myPending ? " …" : ""}
            </p>
          ) : null}
        </div>

        {typing === side ? (
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              unlockSpeech();
              void handleText(side, draft);
              setDraft("");
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={c.placeholder}
              className="h-12 w-full rounded-2xl border border-input bg-card pl-4 pr-12 text-[16px] outline-none focus:border-accent"
            />
            <button
              type="submit"
              aria-label="Enviar"
              disabled={!draft.trim()}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-xl text-accent disabled:text-muted-foreground/30"
            >
              <Send className="size-4" />
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isUser && !isListening ? (
              <div className="no-scrollbar -mx-5 mb-1 flex w-[calc(100%+2.5rem)] gap-2 overflow-x-auto px-5">
                {QUICK.map(([es, en]) => (
                  <button
                    key={es}
                    onClick={() => {
                      unlockSpeech();
                      void handleText("user", es, en);
                    }}
                    className="h-11 shrink-0 rounded-full border border-border bg-card px-4 text-[14px] font-medium"
                  >
                    {es}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              onClick={() => toggleMic(side)}
              disabled={busy && !isListening}
              aria-label={c.tap}
              className={cn(
                "relative flex size-20 items-center justify-center rounded-full shadow-[var(--shadow-lift)] transition-transform active:scale-95 disabled:opacity-50",
                isUser ? "bg-accent text-accent-foreground" : "bg-sky text-white",
              )}
            >
              {isListening ? (
                <>
                  <span
                    className={cn(
                      "absolute inset-0 animate-ping rounded-full",
                      isUser ? "bg-accent/40" : "bg-sky/40",
                    )}
                  />
                  <Square className="relative size-7 fill-current" />
                </>
              ) : (
                <Mic className="size-8" />
              )}
            </button>
            <span className="text-[13px] font-semibold text-muted-foreground">
              {isListening ? c.listening : c.tap}
            </span>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {half("client")}

      <div className="z-10 flex items-center gap-2 bg-primary px-3 py-2 text-primary-foreground">
        <button
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          aria-label="Cerrar"
          className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/10"
        >
          <X className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-tight">Traducir</p>
            <p className="truncate text-[11px] text-primary-foreground/60">
              {client ? client.name : "Español ⇄ English"}
            </p>
          </div>
        </div>
        <IconToggle label="Voltear" onClick={() => setFlip((v) => !v)} active={flip}>
          <ArrowUpDown className="size-5" />
        </IconToggle>
        <IconToggle label="Voz" onClick={() => setVoice((v) => !v)} active={voice}>
          {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </IconToggle>
        <IconToggle
          label="Continuo"
          onClick={() => {
            setContinuous((v) => !v);
            toast(
              continuous
                ? "Modo continuo apagado"
                : "Modo continuo: el micrófono pasa solo al otro lado",
            );
          }}
          active={continuous}
        >
          <Repeat className="size-5" />
        </IconToggle>
        <IconToggle
          label="Guardar"
          onClick={() =>
            turns.some((t) => !t.pending)
              ? setSaving(true)
              : toast.info("Podrás guardar cuando haya al menos una frase traducida.")
          }
          active={false}
          dim={!turns.some((t) => !t.pending)}
        >
          <Save className="size-5" />
        </IconToggle>
      </div>

      {half("user")}

      {saving ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setSaving(false)}
        >
          <div
            role="dialog"
            aria-label="Guardar conversación"
            className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="flex items-center gap-2 text-[17px] font-bold">
              <MessageSquareText className="size-5 text-accent" /> Guardar conversación
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Queda en la ficha del cliente, en español y en inglés.
            </p>
            <div className="mt-4 space-y-2 rounded-2xl bg-muted/50 p-3">
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
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
                Cliente
              </span>
              <select
                value={saveTo}
                onChange={(e) => setSaveTo(e.target.value)}
                className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-[15px] outline-none focus:border-accent"
              >
                <option value="">Elige un cliente</option>
                {state.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconToggle({
  children,
  label,
  onClick,
  active,
  dim,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active: boolean;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex w-12 flex-col items-center gap-0.5", dim && "opacity-40")}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-colors",
          active ? "bg-accent text-accent-foreground" : "bg-primary-foreground/10",
        )}
      >
        {children}
      </span>
      <span className="text-[10px] font-semibold leading-none text-primary-foreground/80">
        {label}
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
