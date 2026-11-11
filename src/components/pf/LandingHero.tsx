import { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { BookLoader } from "./book-loader";
import { IndustryUpload } from "./IndustryUpload";
import { Button } from "@/components/ui/button";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
import { HERO_STILLS, PORTFOLIO_TICKS, type HeroDemo } from "@/lib/portfolia/landing-demo";
import { usePageFileDrop } from "./use-page-drop";
import { ExampleContext, type HeroExample } from "./landing-example-context";

const StudioDemo = lazy(() => import("./StudioDemo").then(m => ({ default: m.StudioDemo })));
const ProductDemo = lazy(() => import("./ProductDemo").then(m => ({ default: m.ProductDemo })));
const ProductUploadBox = lazy(() => import("@/components/products/ProductUploadBox").then(m => ({ default: m.ProductUploadBox })));
const ExampleReader = lazy(() => import("./PdfViewer").then(m => ({ default: m.PdfViewer })));

/* ---------- A page's one live viewer can be switched to another PDF ---------- */


/**
 * Wraps a landing page so a section below the hero (the profession demonstrations) can load its PDF into the hero's
 * viewer instead of mounting a second book: a page never has more than one live 3D book.
 */
export function LandingExampleProvider({ children }: { children: ReactNode }) {
  const [example, setExample] = useState<HeroExample | null>(null);
  const showExample = useCallback((next: HeroExample) => {
    setExample(next);
    // Bring the hero back into view so the visitor sees the example open.
    const hero = document.getElementById("landing-hero");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    hero?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);
  const clearExample = useCallback(() => setExample(null), []);
  const value = useMemo(() => ({ example, showExample, clearExample }), [example, showExample, clearExample]);
  return <ExampleContext.Provider value={value}>{children}</ExampleContext.Provider>;
}

/* ---------- The live example, loaded sensibly ---------- */

const reducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
const saveDataOn = () => typeof navigator !== "undefined" && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/** Mounts once the hero is on screen and the browser is idle, so the 3D book never competes with the first paint. */
function useIdleWhenVisible(target: React.RefObject<HTMLElement | null>, hold: boolean) {
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  useEffect(() => {
    if (hold) return;
    let handle: number | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    if (window.requestIdleCallback) handle = window.requestIdleCallback(() => setIdle(true), { timeout: 1500 });
    else timer = setTimeout(() => setIdle(true), 1500);
    return () => { if (handle !== undefined) window.cancelIdleCallback(handle); clearTimeout(timer); };
  }, [hold]);
  useEffect(() => { if (visible && idle) setArmed(true); }, [visible, idle]);
  return armed;
}

function HeroStage({ demo, tall }: { demo: HeroDemo; tall: string }) {
  const ctx = useContext(ExampleContext);
  // A built-in demo chosen on the page replaces the default one; a PDF opens in the plain reader.
  const chosen = ctx?.example ?? null;
  const pdf = chosen && "url" in chosen ? chosen : null;
  const shown: HeroDemo = chosen && "demo" in chosen ? chosen.demo : demo;
  const stage = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  // Read in an effect: the server cannot know, and the first client render must match it.
  const [saveData, setSaveData] = useState(false);
  const [calm, setCalm] = useState(false);
  useEffect(() => { setSaveData(saveDataOn()); setCalm(reducedMotion()); }, []);
  const armed = useIdleWhenVisible(stage, saveData && !playRequested) || playRequested;
  // The book follows this column's measured height, not the window's (see src/components/pf/AGENTS.md).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const apply = () => el.style.setProperty("--pf-home-stage-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // A different PDF is a new book: show the still again until it is ready.
  useEffect(() => { setReady(false); setFailed(false); }, [pdf?.url, shown]);
  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);
  const still = HERO_STILLS[shown];
  const live = armed && !failed;
  return <div ref={stage} className={`pf-home-stage relative min-w-0 h-[62svh] min-h-[24rem] bg-[#eae6df] ${tall}`}>
    {/* The still is the first thing seen and stays underneath if the live book never loads. */}
    <div aria-hidden={ready} className="absolute inset-0 flex items-center justify-center transition-opacity duration-500 motion-reduce:transition-none" style={{ opacity: ready ? 0 : 1 }}>
      {still ? <img src={still.src} width={still.width} height={still.height} alt="" className="h-full w-full object-contain" /> : <BookLoader tone="light" label="" />}
    </div>
    {live && <div className="absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none" style={{ opacity: ready ? 1 : 0, pointerEvents: ready ? "auto" : "none" }}>
      <Suspense fallback={null}>
        {pdf ? <div className="pf-workspace-demo relative h-full overflow-hidden"><ExampleReader
          key={pdf.url}
          source={{ url: pdf.url }}
          fileName={pdf.fileName}
          viewer={{ ...DEFAULT_VIEWER, mode: "book", look: "studio", looks: ["clean", "studio"], background: "paper", backgroundColor: "#e9e8df", studioLighting: "1", studioBrightness: 0.64 }}
          projects={pdf.projects === false ? undefined : [{ id: "intro", title: "Introduction", startPage: 1, endPage: 2 }, { id: "work", title: "Selected work", startPage: 3, endPage: 5 }, { id: "notes", title: "About this example", startPage: 6, endPage: 6 }] }
          controls lightweight fullSpread homepageExample loadingIndicator={false}
          onBookReadyChange={(value: boolean) => { if (value) onReady(); }}
          onLoadError={onFail}
        /></div>
          : shown === "portfolio" ? <StudioDemo workspace hero className="relative h-full w-full" onReady={onReady} onFail={onFail} />
          : <ProductDemo hero calm={calm} className="relative h-full w-full" onReady={onReady} onFail={onFail} />}
      </Suspense>
    </div>}
    {saveData && !armed && <Button variant="line" size="sm" className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 bg-background" onClick={() => setPlayRequested(true)}>Play live example</Button>}
    {chosen && failed && <p role="status" className="absolute inset-x-4 bottom-6 z-20 mx-auto w-fit rounded-2xl bg-background/90 px-4 py-2 text-xs shadow-soft">That example could not load. <button type="button" className="underline" onClick={ctx?.clearExample}>Show the main example</button></p>}
    <span className="pointer-events-none absolute left-4 top-5 z-20 rounded-full bg-background/90 px-3 py-1.5 text-[11px] shadow-soft">{shown === "product" && !pdf ? "Live product preview" : "Live example"}</span>
  </div>;
}

/* ---------- The shared first screen ---------- */

export interface LandingHeroProps {
  eyebrow?: string;
  heading: ReactNode;
  intro: string;
  demo: HeroDemo;
  upload: "portfolio" | "product";
  uploadLabel?: string;
  ticks?: string[];
  secondary?: ReactNode;
  /** Replaces the standard upload box (the home page keeps its own flow into the editor). */
  uploadNode?: ReactNode;
  /** Controls shown under the eyebrow (the home page's two workspace tabs). */
  tabs?: ReactNode;
  /** The home page handles a dropped file itself and shows its own "Drop your PDF here" cover. */
  onDropFile?: (file: File) => void;
  /** Height of the page header above the hero. */
  headerOffset?: string;
  /** Home shows the whole introduction; other pages keep it to two lines and print it in full below. */
  clampIntro?: boolean;
  className?: string;
}

export function LandingHero({ eyebrow, heading, intro, demo, upload, uploadLabel, ticks = PORTFOLIO_TICKS, secondary, uploadNode, tabs, onDropFile, headerOffset = "4rem", clampIntro = true, className = "" }: LandingHeroProps) {
  const over = usePageFileDrop(file => onDropFile?.(file), Boolean(onDropFile));
  // Tall screens show the start of the next section: the hero is as tall as the window, up to 820 px.
  const tall = "lg:h-auto lg:min-h-[min(calc(100dvh-var(--pf-hero-offset,4rem)),820px)]";
  return <section id="landing-hero" aria-label="What Portfolia offers" style={{ ["--pf-hero-offset" as string]: headerOffset }} className={`pf-home-example pf-home-split relative grid bg-background lg:grid-cols-[minmax(24rem,2fr)_3fr] ${className}`}>
    <div className={`flex flex-col justify-center gap-4 bg-background px-6 py-6 sm:gap-5 sm:px-10 sm:py-10 lg:border-r lg:border-border lg:px-12 xl:px-16 ${tall}`}>
      {eyebrow && <p className="label-xs text-leaf">{eyebrow}</p>}
      {tabs}
      <h1 className="display-title max-w-lg text-[2rem] leading-[1.05] sm:text-5xl xl:text-6xl">{heading}</h1>
      <p className={`text-base leading-relaxed text-muted-foreground ${clampIntro ? "max-w-lg line-clamp-3 lg:line-clamp-2" : "max-w-md"}`}>{intro}</p>
      {uploadNode ?? (upload === "portfolio"
        ? <IndustryUpload compact pageDrop label={uploadLabel ?? "Choose PDF"} />
        : <Suspense fallback={<div className="h-[4.5rem] w-full max-w-md rounded-2xl border border-dashed border-border-strong bg-canvas" aria-hidden />}><ProductUploadBox pageDrop /></Suspense>)}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {ticks.map(t => <li key={t} className="flex items-center gap-1.5"><Check className="size-3.5 text-leaf" aria-hidden />{t}</li>)}
      </ul>
      {secondary}
    </div>
    <HeroStage demo={demo} tall={tall} />
    {over && <div role="status" className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-background/90"><p className="display-title text-3xl">Drop your PDF here</p></div>}
  </section>;
}
