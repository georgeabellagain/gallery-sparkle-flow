import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { EmbedModal } from "./EmbedModal";
import { PortfolioQrCode } from "./PortfolioQrCode";
import { FEATURED_CREDIT, FEATURED_PORTFOLIO_CODE } from "./StudioDemo";
import { getPublicPortfolio, type PublicPortfolio } from "@/lib/portfolia/public.functions";
import { registerPublicUrls } from "@/lib/portfolia/assets";
import { DEFAULT_VIEWER, type ViewerSettings } from "@/lib/portfolia/store";
import { readableFoldouts } from "@/lib/portfolia/foldouts";
import { readablePageTags } from "@/lib/portfolia/page-extras";

const FEATURES = [
  { id: "book", label: "Flipbook", title: "Let the work lead.", text: "The real page turn, with your PDF layout preserved. Try turning a page yourself." },
  { id: "paged", label: "Page by page", title: "One page at a time.", text: "A focused view for the details. Use the reader’s arrows to move through the actual lookbook." },
  { id: "scroll", label: "Scroll", title: "Read at your own pace.", text: "A continuous view of the same PDF, with selectable text and its original web links." },
  { id: "background", label: "Backdrops", title: "Set the scene.", text: "Try a different colour around the same pages. These are real viewer settings, applied only to this demonstration." },
  { id: "lighting", label: "Studio light", title: "Paper in a different light.", text: "Compare the actual Studio lighting presets on the example portfolio." },
  { id: "notes", label: "Scrapbook", title: "Details worth opening.", text: "These are the notes saved in this portfolio, rendered with the same paper and lighting. Click or drag a flap to open it." },
  { id: "tabs", label: "Page tabs", title: "Find your way through.", text: "The saved coloured tabs sit on the actual book. Click one to jump to its page." },
  { id: "share", label: "Share & embed", title: "One link, ready to send.", text: "Open the real example, download its QR code or try the same embed controls used by portfolio owners." },
] as const;
const COLOURS = ["#f1f1ef", "#e6ded0", "#191d3a"];
const SLIDE_MS = 10000;

export function FeatureShowcase() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [near, setNear] = useState(false);
  const [motion, setMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(0);
  const [data, setData] = useState<PublicPortfolio>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [variation, setVariation] = useState(0);
  const [dialog, setDialog] = useState<"qr" | "embed" | null>(null);
  const [copied, setCopied] = useState(false);
  const feature = FEATURES[selected]!;
  const p = data?.portfolio;
  const url = p?.pdf && data?.urls[p.pdf.blobKey];
  const source = useMemo(() => url ? { url } : null, [url]);
  const notes = useMemo(() => readableFoldouts(p?.pdf?.foldouts, p?.pdf?.pages ?? 0), [p]);
  const tabs = useMemo(() => readablePageTags(p?.pdf?.tags, p?.pdf?.pages ?? 0), [p]);
  const playing = motion && visible && !paused && !hovered && !dialog;
  const publicUrl = `https://portfolia.site/p/${FEATURED_PORTFOLIO_CODE}`;
  const onReady = useCallback((value: boolean) => setReady(value), []);
  const onError = useCallback(() => setFailed(true), []);
  const choose = (index: number, manual = true) => {
    if (manual) setPaused(true);
    const next = (index + FEATURES.length) % FEATURES.length;
    if (next === selected) return;
    setSelected(next);
    setReady(false); setVariation(0); setSlow(false);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!media.matches && !document.hidden);
    update(); media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(Boolean(entry?.isIntersecting));
      if (entry?.isIntersecting) setNear(true);
    }, { threshold: .15 });
    if (ref.current) observer.observe(ref.current);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    setFailed(false); setData(null);
    const timeout = setTimeout(() => { cancelled = true; setFailed(true); }, 30000);
    void getPublicPortfolio({ data: { by: "code", value: FEATURED_PORTFOLIO_CODE } }).then(result => {
      if (cancelled) return;
      clearTimeout(timeout);
      if (!result?.portfolio.pdf || !result.urls[result.portfolio.pdf.blobKey]) { setFailed(true); return; }
      registerPublicUrls(result.urls);
      setData(result);
    }).catch(() => { if (!cancelled) { clearTimeout(timeout); setFailed(true); } });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [near, attempt]);
  useEffect(() => {
    setSlow(false);
    if (ready || failed) return;
    const timer = setTimeout(() => setSlow(true), 25000);
    return () => clearTimeout(timer);
  }, [ready, failed, selected, attempt]);
  useEffect(() => {
    if (!playing || !ready || failed) return;
    const next = setTimeout(() => choose(selected + 1, false), SLIDE_MS);
    return () => clearTimeout(next);
  }, [playing, ready, failed, selected]);
  useEffect(() => {
    if (!playing || !ready || !["background", "lighting"].includes(feature.id)) return;
    const timer = setInterval(() => setVariation(n => (n + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, [playing, ready, feature.id]);

  const mode = feature.id === "paged" || feature.id === "scroll" ? feature.id : "book";
  const viewer: ViewerSettings = {
    ...DEFAULT_VIEWER, ...p?.viewer, mode, modes: [mode],
    look: feature.id === "book" ? "clean" : "studio",
    looks: ["clean", "studio"],
    ...(feature.id === "background" ? { backgroundColor: COLOURS[variation], backgroundKey: undefined } : {}),
    ...(feature.id === "lighting" ? { studioLighting: (["1", "2", "3"] as const)[variation] } : {}),
  };
  const startPage = feature.id === "notes" ? notes.find(n => n.hinge !== "none")?.page ?? 1 : 1;
  return <section ref={ref} className="rule-t" aria-label="Portfolio features">
    <div className="mx-auto w-full max-w-[1800px] px-4 py-12 sm:px-8 lg:px-12">
      <h2 className="display-title text-3xl sm:text-4xl">More ways to make it yours.</h2>
      <p className="mt-3 text-sm text-muted-foreground">Explore Scarlett’s real lookbook. Every preview uses the actual portfolio reader.</p>
      <div role="tablist" aria-label="Portfolio features" className="mt-6 flex flex-wrap gap-2">
        {FEATURES.map((f, i) => <button key={f.id} id={`feature-tab-${f.id}`} role="tab" aria-selected={selected === i} aria-controls="feature-preview" tabIndex={selected === i ? 0 : -1}
          onClick={() => { if (i !== selected) choose(i); else setPaused(true); }}
          onKeyDown={e => {
            const next = e.key === "ArrowRight" ? (i + 1) % FEATURES.length : e.key === "ArrowLeft" ? (i + FEATURES.length - 1) % FEATURES.length : e.key === "Home" ? 0 : e.key === "End" ? FEATURES.length - 1 : null;
            if (next !== null) { e.preventDefault(); choose(next); document.getElementById(`feature-tab-${FEATURES[next]!.id}`)?.focus(); }
          }}
          className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 ${selected === i ? "border-leaf bg-leaf-soft" : "border-border hover:bg-muted"}`}>{f.label}</button>)}
      </div>
      <div id="feature-preview" role="tabpanel" aria-labelledby={`feature-tab-${feature.id}`} className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0">
          <div className="pf-feature-live relative isolate overflow-hidden rounded-xl border border-border bg-muted"
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onPointerDownCapture={() => setPaused(true)} onKeyDownCapture={() => setPaused(true)} onWheelCapture={() => setPaused(true)}>
            {near && source && p?.pdf && !failed && <div style={{ visibility: ready ? "visible" : "hidden" }}>
              <PdfViewer key={`${feature.id}:${attempt}`} source={source} fileName={p.pdf.name} viewer={viewer}
                startPage={startPage} foldouts={notes} tags={tabs} links={p.pdf.links} projects={p.pdf.projects}
                backgroundUrl={feature.id === "background" ? undefined : p.viewer?.backgroundKey ? data?.urls[p.viewer.backgroundKey] : undefined}
                controls lightweight fullSpread
                autoTurn={playing && ready && ["book", "tabs", "share"].includes(feature.id)} autoTurnDelay={2400}
                demoNotes={playing && ready && feature.id === "notes"}
                onContentReadyChange={onReady} onLoadError={onError} />
            </div>}
            {(!ready || failed) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm" role="status">
              <p>{failed ? "The example is temporarily unavailable." : slow ? "Preparing the real pages is taking longer than usual." : "Preparing Scarlett’s lookbook…"}</p>
              {(failed || slow) && <button type="button" className="underline" onClick={() => { setReady(false); setAttempt(n => n + 1); }}>Try again</button>}
              {failed && <a href={publicUrl} className="underline">Open the example</a>}
            </div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{FEATURED_CREDIT}</p>
            <div className="flex items-center gap-2" aria-label="Feature slideshow">
              <button type="button" aria-label="Previous feature" onClick={() => choose(selected - 1)} className="rounded-full border p-2 hover:bg-muted"><ArrowLeft className="size-4" /></button>
              <span className="px-1 text-xs tabular-nums">{selected + 1} / {FEATURES.length}</span>
              <button type="button" aria-label="Next feature" onClick={() => choose(selected + 1)} className="rounded-full border p-2 hover:bg-muted"><ArrowRight className="size-4" /></button>
              <button type="button" aria-label={paused ? "Play feature slideshow" : "Pause feature slideshow"} disabled={!motion} onClick={() => setPaused(v => !v)} className="rounded-full border p-2 hover:bg-muted disabled:opacity-40">{paused || !motion ? <Play className="size-4" /> : <Pause className="size-4" />}</button>
            </div>
          </div>
        </div>
        <div className="self-center py-3 lg:px-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{feature.label}</p>
          <h3 className="display-title mt-3 text-3xl">{feature.title}</h3>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
          {feature.id === "notes" && !notes.length && ready && <p className="mt-3 text-sm">This example currently has no saved notes. No sample notes have been added.</p>}
          {feature.id === "tabs" && !tabs.length && ready && <p className="mt-3 text-sm">This example currently has no saved page tabs.</p>}
          {feature.id === "background" && <div className="mt-5 flex gap-3" role="group" aria-label="Preview background colour">{COLOURS.map((c, i) => <button key={c} type="button" aria-label={["Paper", "Warm neutral", "Midnight"][i]} aria-pressed={variation === i} onClick={() => { setPaused(true); setVariation(i); }} className={`size-9 rounded-full border ${variation === i ? "ring-2 ring-leaf ring-offset-2" : "border-border"}`} style={{ backgroundColor: c }} />)}</div>}
          {feature.id === "lighting" && <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Preview Studio lighting">{[0, 1, 2].map(i => <button key={i} type="button" aria-pressed={variation === i} className={`rounded-full border px-3 py-2 text-xs ${variation === i ? "bg-leaf-soft" : ""}`} onClick={() => { setPaused(true); setVariation(i); }}>Lighting {i + 1}</button>)}</div>}
          {feature.id === "share" && <div className="mt-5 grid gap-2 text-sm">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Open example ↗</a>
            <button type="button" className="text-left underline underline-offset-4" onClick={async () => { setPaused(true); try { await navigator.clipboard.writeText(publicUrl); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Link copied" : "Copy example link"}</button>
            <button type="button" className="text-left underline underline-offset-4" onClick={() => { setPaused(true); setDialog("qr"); }}>Show actual QR code</button>
            <button type="button" className="text-left underline underline-offset-4" onClick={() => { setPaused(true); setDialog("embed"); }}>Try website embedding</button>
          </div>}
          <a href="#upload" className="mt-7 inline-block text-sm font-medium text-leaf underline underline-offset-4">Try your PDF →</a>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Interacting pauses the slideshow. Preview choices do not change Scarlett’s saved portfolio.</p>
        </div>
      </div>
      <PortfolioQrCode open={dialog === "qr"} onClose={() => setDialog(null)} url={publicUrl} name="Scarlett Bushell" />
      <EmbedModal open={dialog === "embed"} onClose={() => setDialog(null)} url={`https://portfolia.site/embed/${FEATURED_PORTFOLIO_CODE}`} title="Scarlett Bushell" />
    </div>
  </section>;
}
