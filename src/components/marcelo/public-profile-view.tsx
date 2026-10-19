import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Clock,
  Droplets,
  Flower2,
  House,
  MessageCircle,
  MapPin,
  Phone,
  ShieldCheck,
  Smile,
  Sparkles,
  Sprout,
  Star,
  TreeDeciduous,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import mark from "@/assets/marcelo-mark.png";
import type { ViewProfile } from "@/lib/public-view";
import { T, type Lang } from "@/lib/public-i18n";
import { formatPhone } from "@/lib/public-profile";
import { areaSummary, covers, isZip } from "@/lib/service-area";
import { AreaMap } from "./area-map";

/**
 * The page a client sees: photo, name, services, "about me", contact and a quote form (passed in
 * as `children`). The same component draws the live page and the preview in "Mi página".
 */
const ICONS: Record<string, LucideIcon> = {
  pasto: Sprout,
  poda: TreeDeciduous,
  limpieza: House,
  riego: Droplets,
  plantas: Flower2,
  reparacion: Wrench,
  general: Wrench,
};

const TRAIT_ICONS: Record<string, LucideIcon> = {
  reliable: ShieldCheck,
  punctual: Clock,
  quality: Star,
  friendly: Smile,
  tidy: Sparkles,
};

const NAVY = "#0b3a6b";
const SHOWN = 4;
const PHOTOS_SHOWN = 3;

export function PublicProfileView({
  profile: p,
  lang,
  onLang,
  children,
}: {
  profile: ViewProfile;
  lang: Lang;
  /** Language switch in the top bar. Omit it to hide the switch (preview). */
  onLang?: (l: Lang) => void;
  /** The quote form. */
  children?: ReactNode;
}) {
  const t = T[lang];
  const [all, setAll] = useState(false);
  const [morePhotos, setMorePhotos] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // A photo that no longer exists (deleted, not republished yet) is simply not shown.
  const [broken, setBroken] = useState<string[]>([]);
  const photos = p.gallery.filter((u) => !broken.includes(u));
  const shownPhotos = morePhotos ? photos : photos.slice(0, PHOTOS_SHOWN);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const shown = all ? p.services : p.services.slice(0, SHOWN);
  const initial = p.businessName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="mx-auto max-w-md overflow-hidden bg-[#f6f3ee] text-[#16263a]">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <img src={mark} alt="" className="size-8" />
          <span className="text-[20px] font-bold" style={{ color: NAVY }}>
            Marcelo
          </span>
        </div>
        {onLang ? (
          <div className="inline-flex rounded-full border border-[#d9e2ee] p-0.5 text-[14px] font-semibold">
            {(["en", "es"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLang(l)}
                aria-pressed={lang === l}
                className={`min-h-9 rounded-full px-4 ${lang === l ? "text-white" : "text-[#4b5b70]"}`}
                style={lang === l ? { background: NAVY } : undefined}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Hero: the person first */}
      <header
        className="relative min-h-[360px] overflow-hidden text-white"
        style={{ background: `linear-gradient(135deg, #0b2a4a, ${NAVY})` }}
      >
        {p.photoUrl ? (
          <img
            src={p.photoUrl}
            alt={p.businessName}
            className="absolute inset-0 size-full object-cover object-top"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute -right-6 bottom-10 flex size-56 items-center justify-center rounded-full bg-white/10 text-[110px] font-bold text-white/40"
          >
            {initial}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b2a4a]/90 via-[#0b2a4a]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b2a4a]/60 via-transparent to-transparent" />
        <div className="relative flex min-h-[360px] max-w-[62%] flex-col justify-center gap-2 px-5 pb-12 pt-6">
          <h1 className="text-[34px] font-bold leading-tight">{p.businessName}</h1>
          {p.tradeEn ? (
            <p className="text-[18px] font-medium leading-snug">
              {p.tradeEn} {t.servicesWord}
            </p>
          ) : null}
          {p.city ? (
            <p className="flex items-center gap-1.5 text-[16px]">
              <MapPin className="size-4 shrink-0" /> {p.city}
            </p>
          ) : null}
          {p.tagline ? (
            <p
              className="mt-3 text-[30px] leading-[1.05] text-[#f7c53b]"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              {p.tagline}
              <span className="mt-1 block h-[3px] w-4/5 rounded-full bg-[#f7c53b]/90" />
            </p>
          ) : null}
        </div>
      </header>

      <main className="relative -mt-8 space-y-6 rounded-t-[32px] bg-[#fbfaf7] px-5 pb-8 pt-6">
        {/* Services */}
        {p.services.length ? (
          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {shown.map((s) => {
                const Icon = ICONS[s.kind] ?? Wrench;
                return (
                  <div key={s.name} className="flex flex-col items-center text-center">
                    <span
                      className="flex size-14 items-center justify-center rounded-full bg-[#eef1f5]"
                      style={{ color: NAVY }}
                    >
                      <Icon className="size-7" strokeWidth={1.7} />
                    </span>
                    <span className="mt-2 text-[16px] font-semibold leading-tight">{s.name}</span>
                    {s.fromPrice ? (
                      <span className="mt-0.5 text-[15px] text-[#4b5b70]">
                        {t.from} ${s.fromPrice}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {p.services.length > SHOWN ? (
              <button
                type="button"
                onClick={() => setAll(!all)}
                className="mt-4 w-full text-center text-[15px] font-semibold"
                style={{ color: NAVY }}
              >
                {all ? t.seeLess : `${t.seeAll} (${p.services.length})`}
              </button>
            ) : null}
          </section>
        ) : null}

        {/* About me */}
        {p.bio || p.traits.length ? (
          <section>
            <h2 className="text-[24px] font-bold" style={{ color: NAVY }}>
              {t.aboutMe}
            </h2>
            {p.bio ? (
              <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed">{p.bio}</p>
            ) : null}
            {p.traits.length ? (
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {p.traits.map((k) => {
                  const Icon = TRAIT_ICONS[k] ?? Star;
                  const label = (t.traits as Record<string, string>)[k];
                  return label ? (
                    <li key={k} className="flex items-center gap-1.5 text-[16px] font-medium">
                      <Icon className="size-5" style={{ color: NAVY }} /> {label}
                    </li>
                  ) : null;
                })}
              </ul>
            ) : null}
            <p
              className="mt-4 text-right text-[26px] leading-tight text-[#16263a]"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              {t.thanks}
            </p>
          </section>
        ) : null}

        {/* Contact (only when the worker chose to show their number) */}
        {p.phone ? (
          <section className="grid grid-cols-2 gap-3">
            <a
              href={`tel:+1${p.phone}`}
              className="flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 text-white"
              style={{ background: NAVY }}
            >
              <span className="flex items-center gap-2 text-[17px] font-semibold">
                <Phone className="size-5" /> {t.call}
              </span>
              <span className="text-[14px] opacity-90">{formatPhone(p.phone)}</span>
            </a>
            <a
              href={`https://wa.me/1${p.phone}`}
              className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 bg-white px-2 text-[17px] font-semibold"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              <MessageCircle className="size-5" /> {t.message}
            </a>
          </section>
        ) : null}

        <AreaSection p={p} lang={lang} />

        {photos.length ? (
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[24px] font-bold" style={{ color: NAVY }}>
                {t.ourWork}
              </h2>
              {photos.length > PHOTOS_SHOWN ? (
                <button
                  type="button"
                  onClick={() => setMorePhotos(!morePhotos)}
                  className="min-h-12 text-[15px] font-semibold"
                  style={{ color: NAVY }}
                >
                  {morePhotos ? t.seeLessPhotos : `${t.seeMore} ›`}
                </button>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {shownPhotos.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setOpen(u)}
                  className="aspect-square overflow-hidden rounded-xl bg-[#eef1f5]"
                >
                  <img
                    src={u}
                    alt={`${t.ourWork} ${i + 1}`}
                    loading="lazy"
                    onError={() => setBroken((b) => [...b, u])}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <a
          href="#quote"
          className="flex h-14 items-center justify-between rounded-full px-6 text-[17px] font-semibold text-white"
          style={{ background: NAVY }}
        >
          <span className="flex-1 text-center">{t.quote}</span>
          <ArrowRight className="size-5" />
        </a>

        {children}

        <p className="pt-2 text-center text-[15px] text-[#4b5b70]">{t.footer}</p>
        <p className="text-center text-[13px] text-[#7a8798]">{t.powered}</p>
      </main>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            aria-label={t.closePhoto}
            onClick={() => setOpen(null)}
            className="absolute right-3 top-3 flex size-12 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="size-6" />
          </button>
          <img
            src={open}
            alt=""
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

const ZIPS_SHOWN = 10;

/** Where the worker works: the perimeter (center + radius), the ZIP codes, a note and a ZIP check. */
function AreaSection({ p, lang }: { p: ViewProfile; lang: Lang }) {
  const t = T[lang];
  const [all, setAll] = useState(false);
  const [zip, setZip] = useState("");
  if (!p.areaZips.length && !p.serviceArea) return null;
  const shown = all ? p.areaZips : p.areaZips.slice(0, ZIPS_SHOWN);
  const hidden = p.areaZips.length - ZIPS_SHOWN;
  const result = covers(p.areaZips, zip);
  const summary = areaSummary(p.areaCenterZip, p.areaRadiusMi, lang);

  return (
    <section className="rounded-2xl bg-[#eef1f5] px-4 py-3 text-[16px]">
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="size-5 shrink-0" style={{ color: NAVY }} /> {t.area}
      </h2>
      {summary ? <p className="mt-1">{summary}</p> : null}
      {p.areaZips.length ? (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t.area}>
            {shown.map((z) => (
              <li key={z} className="rounded-full bg-white px-2.5 py-1 text-[14px]">
                {z}
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="mt-1 min-h-12 text-[15px] font-semibold"
              style={{ color: NAVY }}
            >
              {all ? t.fewerZips : `+${hidden} ${t.moreZips}`}
            </button>
          ) : null}
        </>
      ) : null}
      {p.areaGeo.center || p.areaGeo.points.length ? (
        <AreaMap
          center={p.areaGeo.center}
          points={p.areaGeo.points}
          radiusMi={p.areaRadiusMi}
          lang={lang}
        />
      ) : null}
      {p.serviceArea ? <p className="mt-2 text-[#4b5b70]">{p.serviceArea}</p> : null}

      {p.areaZips.length ? (
        <div className="mt-3 border-t border-[#d9e2ee] pt-3">
          <label className="block">
            <span className="text-[15px] font-semibold">{t.coverTitle}</span>
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder={t.coverPlaceholder}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              className="mt-1.5 h-12 w-full rounded-2xl border border-input bg-white px-4 text-[16px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            />
          </label>
          {isZip(zip) ? (
            <p
              role="status"
              className={`mt-2 text-[15px] font-medium ${result === "yes" ? "text-[#1f7a3d]" : "text-[#9a5b00]"}`}
            >
              {result === "yes" ? `✓ ${t.coverYes} ${zip}.` : `${zip} ${t.coverNo}`}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
