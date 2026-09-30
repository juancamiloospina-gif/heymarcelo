/**
 * Browser speech helpers shared by the assistant and the interpreter: dictation
 * (Web Speech API) and text-to-speech with the most natural voice the phone has.
 */

export type Lang = "es" | "en";

const locale: Record<Lang, string> = { es: "es-US", en: "en-US" };

// Minimal typing for the Web Speech API, which isn't in TypeScript's DOM lib.
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function canDictate() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

/** Starts one dictation. `onText` gets interim text; `onFinal` the final phrase. */
export function dictate(
  lang: Lang,
  handlers: {
    onText: (t: string) => void;
    onFinal: (t: string) => void;
    onError: () => void;
    onEnd: () => void;
  },
): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = locale[lang];
  rec.interimResults = true;
  rec.continuous = false;
  let finished = false;
  rec.onresult = (e) => {
    const results = Array.from(e.results);
    const transcript = results
      .map((r) => r[0]?.transcript ?? "")
      .join(" ")
      .trim();
    handlers.onText(transcript);
    if (results[results.length - 1]?.isFinal && !finished) {
      finished = true;
      handlers.onFinal(transcript);
    }
  };
  rec.onerror = handlers.onError;
  rec.onend = handlers.onEnd;
  rec.start();
  return rec;
}

/** Prefers natural-sounding voices (and US/Mexican Spanish) over the robotic default. */
function bestVoice(lang: Lang) {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(lang));
  const regional = lang === "es" ? /^es-(us|mx)/i : /^en-us/i;
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced|google|siri/i.test(v.name) ? 4 : 0) +
    (regional.test(v.lang) ? 2 : 0) +
    (v.localService ? 0 : 1);
  return voices.sort((a, b) => score(b) - score(a))[0];
}

export function speak(text: string, lang: Lang = "es") {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale[lang];
    u.rate = 1.03;
    const voice = bestVoice(lang);
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* no speech synthesis */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * iOS only lets a page speak after a user gesture. Call this from a tap handler so the
 * translation can be spoken later, when it arrives asynchronously.
 */
export function unlockSpeech() {
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis?.speak(u);
  } catch {
    /* ignore */
  }
}
