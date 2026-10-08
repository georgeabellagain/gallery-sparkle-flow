import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { FeatureAnimation } from "./FeatureAnimation";
import {
  FEATURED_CREDIT,
  FEATURED_PORTFOLIO_CODE,
  loadFeaturedPortfolio,
} from "./StudioDemo";
import { type PublicPortfolio } from "@/lib/portfolia/public.functions";
import { registerPublicUrls } from "@/lib/portfolia/assets";

const FEATURES = [
  {
    id: "paged",
    label: "Page by page",
    title: "One page at a time.",
    text: "Give each page its own moment, with a simple sliding transition.",
  },
  {
    id: "scroll",
    label: "Scroll",
    title: "Read at your own pace.",
    text: "Let your work flow in one continuous, easy-to-follow view.",
  },
  {
    id: "background",
    label: "Backdrops",
    title: "Set the scene.",
    text: "Frame your portfolio with a background that suits your work.",
  },
  {
    id: "lighting",
    label: "Studio light",
    title: "Paper in a different light.",
    text: "Soft shadows and changing light bring pages 9–12 of the lookbook into focus.",
  },
  // Scrapbook ("notes") hidden for now — restore this entry to show it again.
  {
    id: "tabs",
    label: "Page tabs",
    title: "Find your way through.",
    text: "A small touch of colour. One click takes your reader straight to the right page.",
  },
  {
    id: "share",
    label: "Share & embed",
    title: "One link, ready to send.",
    text: "Send your portfolio with one link, or make it part of your own website.",
  },
] as const;
const SLIDE_MS = 10000;

export function FeatureShowcase() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [near, setNear] = useState(false);
  const [motion, setMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [selected, setSelected] = useState(0);
  const [data, setData] = useState<PublicPortfolio>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [readiness, setReadiness] = useState<Record<string, boolean>>({});
  const [slideErrors, setSlideErrors] = useState<Record<string, boolean>>({});
  const [slow, setSlow] = useState(false);
  const feature = FEATURES[selected]!;
  const p = data?.portfolio;
  const url = p?.pdf && data?.urls[p.pdf.blobKey];
  const playing = motion && visible && !paused;
  const publicUrl = `https://portfolia.site/p/${FEATURED_PORTFOLIO_CODE}`;
  const ready = Boolean(readiness[feature.id]);
  const upcoming = FEATURES[(selected + 1) % FEATURES.length]!;
  const slideFailed = failed || slideErrors[feature.id];
  const handlers = useMemo(
    () =>
      Object.fromEntries(
        FEATURES.map((f) => [
          f.id,
          {
            onReady: (value: boolean) =>
              setReadiness((prev) =>
                prev[f.id] === value ? prev : { ...prev, [f.id]: value },
              ),
            onError: () =>
              setSlideErrors((prev) => ({ ...prev, [f.id]: true })),
          },
        ]),
      ),
    [],
  );
  const choose = (index: number, manual = true) => {
    if (manual) setAutoAdvance(false);
    const next = (index + FEATURES.length) % FEATURES.length;
    if (next === selected) return;
    setSelected(next);
    setSlow(false);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!media.matches && !document.hidden);
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(Boolean(entry?.isIntersecting));
        if (entry?.isIntersecting) setNear(true);
      },
      { threshold: 0.15 },
    );
    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          preload.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    if (ref.current) {
      observer.observe(ref.current);
      preload.observe(ref.current);
    }
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      observer.disconnect();
      preload.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    setFailed(false);
    setData(null);
    setReadiness({});
    setSlideErrors({});
    const timeout = setTimeout(() => {
      cancelled = true;
      setFailed(true);
    }, 30000);
    void loadFeaturedPortfolio(attempt > 0)
      .then((result) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (
          !result?.portfolio.pdf ||
          !result.urls[result.portfolio.pdf.blobKey]
        ) {
          setFailed(true);
          return;
        }
        registerPublicUrls(result.urls);
        setData(result);
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeout);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [near, attempt]);
  useEffect(() => {
    setSlow(false);
    if (ready || failed) return;
    const timer = setTimeout(() => setSlow(true), 25000);
    return () => clearTimeout(timer);
  }, [ready, failed, selected, attempt]);
  useEffect(() => {
    if (!playing || !autoAdvance || !ready || failed || !readiness[upcoming.id])
      return;
    const next = setTimeout(
      () => choose(selected + 1, false),
      feature.id === "lighting" ? 22000 : SLIDE_MS,
    );
    return () => clearTimeout(next);
  }, [playing, autoAdvance, ready, failed, selected, readiness, upcoming.id]);
  return (
    <section ref={ref} className="rule-t" aria-label="Portfolio features">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-12 sm:px-8 lg:px-12">
        <h2 className="display-title text-3xl sm:text-4xl">
          More ways to make it yours.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Small details. More ways to tell your story.
        </p>
        <div
          role="tablist"
          aria-label="Portfolio features"
          className="mt-6 flex flex-wrap gap-2"
        >
          {FEATURES.map((f, i) => (
            <button
              key={f.id}
              id={`feature-tab-${f.id}`}
              role="tab"
              aria-selected={selected === i}
              aria-controls="feature-preview"
              tabIndex={selected === i ? 0 : -1}
              onClick={() => {
                if (i !== selected) choose(i);
                else setAutoAdvance(false);
              }}
              onKeyDown={(e) => {
                const next =
                  e.key === "ArrowRight"
                    ? (i + 1) % FEATURES.length
                    : e.key === "ArrowLeft"
                      ? (i + FEATURES.length - 1) % FEATURES.length
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? FEATURES.length - 1
                          : null;
                if (next !== null) {
                  e.preventDefault();
                  choose(next);
                  document
                    .getElementById(`feature-tab-${FEATURES[next]!.id}`)
                    ?.focus();
                }
              }}
              className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 ${selected === i ? "border-leaf bg-leaf-soft" : "border-border hover:bg-muted"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div
          id="feature-preview"
          role="tabpanel"
          aria-labelledby={`feature-tab-${feature.id}`}
          className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:gap-8"
        >
          <div className="min-w-0">
            <div className="pf-feature-live relative isolate overflow-hidden rounded-xl border border-border bg-[#10162e]">
              {near &&
                url &&
                p?.pdf &&
                !failed &&
                [feature, upcoming].map((f) => (
                  <div
                    key={`${f.id}:${attempt}`}
                    className="absolute inset-0"
                    style={{
                      visibility: f.id === feature.id ? "visible" : "hidden",
                      opacity: f.id === feature.id ? 1 : 0,
                      pointerEvents: f.id === feature.id ? "auto" : "none",
                    }}
                    aria-hidden={f.id !== feature.id}
                    inert={f.id !== feature.id}
                  >
                    <FeatureAnimation
                      url={url}
                      feature={f.id}
                      playing={playing && f.id === feature.id}
                      settings={p.viewer}
                      onReady={handlers[f.id]!.onReady}
                      onError={handlers[f.id]!.onError}
                    />
                  </div>
                ))}
              {(!ready || slideFailed) && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/80"
                  role="status"
                >
                  <p>
                    {slideFailed
                      ? "The example is temporarily unavailable."
                      : slow
                        ? "Preparing the real pages is taking longer than usual."
                        : "Preparing Scarlett’s lookbook…"}
                  </p>
                  {(slideFailed || slow) && (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setAttempt((n) => n + 1);
                      }}
                    >
                      Try again
                    </button>
                  )}
                  {slideFailed && (
                    <a href={publicUrl} className="underline">
                      Open the example
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{FEATURED_CREDIT}</p>
              <div
                className="flex items-center gap-2"
                aria-label="Feature slideshow"
              >
                <button
                  type="button"
                  aria-label="Previous feature"
                  onClick={() => choose(selected - 1)}
                  className="rounded-full border p-2 hover:bg-muted"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span className="px-1 text-xs tabular-nums">
                  {selected + 1} / {FEATURES.length}
                </span>
                <button
                  type="button"
                  aria-label="Next feature"
                  onClick={() => choose(selected + 1)}
                  className="rounded-full border p-2 hover:bg-muted"
                >
                  <ArrowRight className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={
                    paused
                      ? "Play feature slideshow"
                      : "Pause feature slideshow"
                  }
                  disabled={!motion}
                  onClick={() => {
                    setPaused((v) => !v);
                    setAutoAdvance(true);
                  }}
                  className="rounded-full border p-2 hover:bg-muted disabled:opacity-40"
                >
                  {paused || !motion ? (
                    <Play className="size-4" />
                  ) : (
                    <Pause className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="self-center py-3 lg:px-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {feature.label}
            </p>
            <h3 className="display-title mt-3 text-3xl">{feature.title}</h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {feature.text}
            </p>
            <a
              href="#upload"
              className="mt-7 inline-block text-sm font-medium text-leaf underline underline-offset-4"
            >
              Try your PDF →
            </a>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              Artwork from Scarlett Bushell’s lookbook. Feature demonstrations
              loop automatically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
