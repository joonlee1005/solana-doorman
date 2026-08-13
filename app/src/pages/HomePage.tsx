import { useEffect, useState } from "react";
import { T, localizeDate, type Lang } from "../i18n";
import {
  ALL_CATEGORY,
  CATEGORIES,
  CATEGORY_EN,
  eventImageBackground,
  HERO_EVENT_MAP,
  HERO_GRADIENTS,
  RAW_EVENTS,
} from "../mock/events";

interface HomePageProps {
  lang: Lang;
  onSelectEvent: (eventIdx: number) => void;
}

export function HomePage({ lang, onSelectEvent }: HomePageProps) {
  const t = T[lang];

  const [heroIdx, setHeroIdx] = useState(0);
  const [heroHovering, setHeroHovering] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);

  useEffect(() => {
    if (heroHovering) return;
    const id = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_GRADIENTS.length), 5000);
    return () => clearInterval(id);
  }, [heroHovering]);

  function goToHeroSlide(i: number) {
    setHeroIdx(i);
  }

  // TODO: replace RAW_EVENTS with useChainData().events once on-chain events
  // carry display metadata (title/venue/date/category/hero art).
  const q = search.trim().toLowerCase();
  const filtered = RAW_EVENTS.map((e, idx) => ({ e, idx })).filter(({ e }) => {
    const matchesCat = category === ALL_CATEGORY || e.category === category;
    const matchesQ = !q || e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  return (
    <>
      <div
        className="relative h-[800px] cursor-pointer overflow-hidden"
        onMouseEnter={() => setHeroHovering(true)}
        onMouseLeave={() => setHeroHovering(false)}
        onClick={() => onSelectEvent(HERO_EVENT_MAP[heroIdx])}
      >
        {HERO_GRADIENTS.map((gradient, i) => {
          const heroEvent = RAW_EVENTS[HERO_EVENT_MAP[i]];
          return heroEvent?.image ? (
            <img
              key={i}
              src={heroEvent.image}
              alt=""
              className="absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-1000 ease-out"
              style={{ opacity: i === heroIdx ? 1 : 0 }}
            />
          ) : (
            <div
              key={i}
              className="absolute inset-0 z-0 transition-opacity duration-1000 ease-out"
              style={{ background: gradient, opacity: i === heroIdx ? 1 : 0 }}
            />
          );
        })}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-black/25" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2/3 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        {HERO_EVENT_MAP.map((eventIdx, i) => {
          const heroEvent = RAW_EVENTS[eventIdx];
          if (!heroEvent) return null;
          return (
            <h2
              key={i}
              className="pointer-events-none absolute bottom-14 left-8 z-[2] max-w-[70%] text-[28px] font-extrabold leading-tight text-white transition-opacity duration-1000 ease-out"
              style={{ opacity: i === heroIdx ? 1 : 0, textShadow: "0 2px 12px rgba(0,0,0,0.55)" }}
            >
              {heroEvent.title}
            </h2>
          );
        })}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToHeroSlide((heroIdx - 1 + HERO_GRADIENTS.length) % HERO_GRADIENTS.length);
          }}
          className="absolute left-7 top-1/2 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-header-text"
          aria-label={lang === "ko" ? "이전" : "Previous"}
        >
          ‹
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToHeroSlide((heroIdx + 1) % HERO_GRADIENTS.length);
          }}
          className="absolute right-7 top-1/2 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xl text-header-text"
          aria-label={lang === "ko" ? "다음" : "Next"}
        >
          ›
        </button>
        <div className="absolute inset-x-0 bottom-[18px] z-[2] flex justify-center gap-[7px]">
          {HERO_GRADIENTS.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                goToHeroSlide(i);
              }}
              aria-label={lang === "ko" ? `슬라이드 ${i + 1}` : `Slide ${i + 1}`}
              className={`h-[7px] w-[7px] rounded-full ${i === heroIdx ? "bg-brand-teal" : "bg-white/20"}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-bg">
        <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-14">
          <div className="mb-8">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-brand-teal-dark">
              {t.trendingLabel}
            </div>
            <h2 className="m-0 mb-2 text-[32px] font-extrabold tracking-tight text-text">{t.heroTitle}</h2>
            {t.heroSub && <p className="m-0 text-sm text-text-muted">{t.heroSub}</p>}
          </div>

          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-border bg-surface px-[18px] py-3.5">
            <span className="text-[15px] text-text-muted">⌕</span>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-faint"
            />
          </div>

          <div className="mb-8 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                    active
                      ? "border-brand-teal bg-brand-teal/[0.14] text-brand-teal"
                      : "border-border text-text-muted"
                  }`}
                >
                  {lang === "ko" ? cat : CATEGORY_EN[cat]}
                </button>
              );
            })}
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
              {filtered.map(({ e, idx }) => (
                <div
                  key={idx}
                  onClick={() => onSelectEvent(idx)}
                  className="cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_3px_rgba(20,25,29,0.04)] transition hover:border-brand-teal hover:shadow-[0_6px_16px_rgba(20,25,29,0.08)]"
                >
                  {e.image ? (
                    <img src={e.image} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div
                      className="flex aspect-video w-full items-center justify-center font-mono text-[11px] tracking-[0.02em]"
                      style={{ background: eventImageBackground(e.hue), color: `hsl(${e.hue} 15% 55%)` }}
                    />
                  )}
                  <div className="px-[18px] pb-[18px] pt-4">
                    <div className="mb-2.5 inline-block rounded-md bg-brand-teal/[0.12] px-2 py-0.5 text-[11px] font-bold text-brand-teal-dark">
                      {lang === "ko" ? e.category : CATEGORY_EN[e.category]}
                    </div>
                    <div className="mb-2 text-base font-bold leading-tight text-text">{e.title}</div>
                    <div className="mb-0.5 text-[13px] text-text-muted">{localizeDate(e.date, lang)}</div>
                    <div className="mb-3.5 text-[13px] text-text-muted">
                      {lang === "ko" ? `${e.venue} · ${e.countryKo}` : `${e.venue} · ${e.countryEn}`}
                    </div>
                    <div className="text-sm font-bold text-text">
                      {lang === "ko" ? `${e.minPrice} USDC 부터` : `From ${e.minPrice} USDC`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-text-muted">{t.noResults}</div>
          )}
        </div>
      </div>
    </>
  );
}
