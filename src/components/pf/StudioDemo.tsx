import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bookFocus, bookLayout } from "@/lib/portfolia/book-layout";
import { createBookScene, type BookFaces, type BookScene, type StudioSettings } from "@/lib/portfolia/book-scene";
import { DEFAULT_SIMPLE_SHADOW_OPACITY } from "@/lib/portfolia/lighting";
import { Segmented } from "@/components/pf/viewer-ui";

const MIDNIGHT = "#191d3a";
/** Pages are drawn in a 900 x 1272 space and scaled to the real canvas size. */
const DESIGN_W = 900;
const DESIGN_H = 1272;
const RATIO = DESIGN_H / DESIGN_W;
const PAGES = 10;
const layout = bookLayout(PAGES, false);
/** The most turns that can be queued by clicking quickly. */
const MAX_QUEUE = 12;

/** The two looks a visitor can switch between, as in the real flipbook. The example starts on Simple. */
const SIMPLE_LOOK: StudioSettings = {
  studio: false,
  material: "satin",
  brightness: 0.7,
  hdri: "4",
  simpleShadow: true,
  simpleShadowOpacity: DEFAULT_SIMPLE_SHADOW_OPACITY,
};
const STUDIO_LOOK: StudioSettings = { ...SIMPLE_LOOK, studio: true };

const PALETTES: [string, string, string][] = [
  ["#ff4d6d", "#ff9e00", "#ffe066"],
  ["#4361ee", "#4cc9f0", "#b8f2e6"],
  ["#7209b7", "#f72585", "#ffb3c6"],
  ["#06d6a0", "#118ab2", "#ffd166"],
  ["#ff7b00", "#ffbe0b", "#fb5607"],
  ["#3a0ca3", "#7209b7", "#4cc9f0"],
  ["#ef476f", "#ffd166", "#06d6a0"],
  ["#f15bb5", "#9b5de5", "#00bbf9"],
  ["#00b4d8", "#90e0ef", "#f9c74f"],
  ["#ff6b6b", "#feca57", "#48dbfb"],
];
const TITLES = [
  "Selected work",
  "Brand identity",
  "Poster series",
  "Editorial",
  "Photography",
  "Illustration",
  "Packaging",
  "Interiors",
  "Motion",
  "Say hello",
];
const CAPTIONS = [
  "Portfolio 2026",
  "A visual system for a coastal studio",
  "Type-led posters for a music festival",
  "Magazine layouts and art direction",
  "Light, landscape and quiet places",
  "Characters and pattern for children’s books",
  "Packaging for small-batch ceramics",
  "Residential interiors in warm tones",
  "Titles and animation for short films",
  "hello@yourname.com",
];

/** A small repeatable random source, so every page always looks the same. */
function random(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws one colourful portfolio page. Three layouts repeat so spreads feel varied. */
function drawPage(n: number, width: number): HTMLCanvasElement {
  const scale = width / DESIGN_W;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(DESIGN_H * scale);
  // Each page's position in the book gives it its own, repeatable imperfections.
  canvas.dataset["seed"] = String(n);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);
  const [a, b, c] = PALETTES[n % PALETTES.length]!;
  const kind = n % 3;
  const diagonal = (from: string, to: string, x0 = 0, y0 = 0, x1 = DESIGN_W, y1 = DESIGN_H) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  };

  if (kind === 0) {
    ctx.fillStyle = diagonal(a, b);
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.22;
    circle(ctx, 700, 260, 280);
    circle(ctx, 120, 980, 360);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = c;
    circle(ctx, 330, 560, 170);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ffffff";
    circle(ctx, 330, 560, 8);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) ctx.fillRect(70 + i * 22, 200, 3, 60);
    ctx.globalAlpha = 1;
  } else if (kind === 1) {
    ctx.fillStyle = "#fffaf3";
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.save();
    roundedRect(ctx, 70, 255, 760, 615, 30);
    ctx.clip();
    // A stylised landscape photograph.
    ctx.fillStyle = diagonal(a, c, 70, 255, 70, 870);
    ctx.fillRect(70, 255, 760, 615);
    ctx.fillStyle = "#fff4d6";
    ctx.globalAlpha = 0.9;
    circle(ctx, 610, 400, 92);
    ctx.globalAlpha = 1;
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.moveTo(70, 760);
    ctx.lineTo(300, 500);
    ctx.lineTo(480, 700);
    ctx.lineTo(650, 540);
    ctx.lineTo(830, 740);
    ctx.lineTo(830, 870);
    ctx.lineTo(70, 870);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.moveTo(70, 820);
    ctx.lineTo(260, 660);
    ctx.lineTo(430, 800);
    ctx.lineTo(600, 690);
    ctx.lineTo(830, 830);
    ctx.lineTo(830, 870);
    ctx.lineTo(70, 870);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    [a, b, c].forEach((colour, i) => {
      ctx.fillStyle = colour;
      roundedRect(ctx, 70 + i * 120, 930, 96, 96, 20);
      ctx.fill();
    });
    ctx.fillStyle = "#d9d2c6";
    ctx.fillRect(70, 1100, 520, 6);
    ctx.fillRect(70, 1130, 360, 6);
  } else {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.fillStyle = b;
    ctx.fillRect(0, DESIGN_H * 0.46, DESIGN_W, DESIGN_H);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(DESIGN_W / 2, DESIGN_H * 0.46, 250, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let i = 0; i < 4; i++) ctx.fillRect(70, 880 + i * 38, 760 - i * 120, 14);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) circle(ctx, 640 + x * 34, 120 + y * 34, 4);
  }

  // A fine print grain, so flat colour never looks digital.
  const next = random(n + 1);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = next() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(next() * DESIGN_W, next() * DESIGN_H, 1.6, 1.6);
  }

  ctx.fillStyle = kind === 1 ? "#1b1b2f" : "#ffffff";
  ctx.font = "30px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(`PORTFOLIA / ${String(n + 1).padStart(2, "0")}`, 70, 90);
  ctx.font = "104px 'Instrument Serif', Georgia, serif";
  ctx.fillText(TITLES[n % TITLES.length]!, 70, kind === 1 ? 205 : DESIGN_H - 150);
  ctx.font = "italic 38px 'Instrument Serif', Georgia, serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText(CAPTIONS[n % CAPTIONS.length]!, 70, kind === 1 ? 1210 : DESIGN_H - 90);
  ctx.globalAlpha = 1;
  return canvas;
}

/**
 * A self-playing studio flipbook for the homepage. It only starts when it
 * scrolls into view and pauses when it leaves, so it costs nothing elsewhere.
 */
export function StudioDemo({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ manual: (dir: 1 | -1) => void; setLook: (look: "simple" | "studio") => void } | null>(null);
  const [look, setLook] = useState<"simple" | "studio">("simple");
  const lookRef = useRef(look);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let scene: BookScene | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    let busy = false;
    let starting = false;
    let spread = 0;
    let direction: 1 | -1 = 1;
    let queued = 0;
    let pages: HTMLCanvasElement[] = [];

    const facesOf = (index: number): BookFaces => {
      const [l, r] = layout.spreads[index]!;
      return [l === null ? null : pages[l]!, r === null ? null : pages[r]!];
    };
    const focusOf = (index: number) => {
      const s = layout.spreads[index]!;
      return bookFocus(s, s.find((n) => n !== null)!, false);
    };
    const warmNext = () => {
      const next = spread + direction;
      if (!scene || next < 0 || next >= layout.spreads.length) return;
      facesOf(next).forEach((canvas) => scene?.prefetch(canvas));
    };

    const go = async (dir: 1 | -1, speed = 1) => {
      const next = spread + dir;
      if (!scene || busy || next < 0 || next >= layout.spreads.length) return;
      busy = true;
      try {
        await scene.turn(facesOf(spread), facesOf(next), dir, focusOf(next), speed);
        spread = next;
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (reduceMotion || disposed || !visible) return;
      warmNext();
      timer = setTimeout(async () => {
        if (spread >= layout.spreads.length - 1) direction = -1;
        else if (spread <= 0) direction = 1;
        await go(direction);
        // A click made during this automatic turn is played straight after it.
        await drain();
      }, 2600);
    };

    /** Clicks made during a turn are kept and played straight after it, a little quicker. */
    async function drain() {
      while (queued !== 0 && !disposed) {
        const dir: 1 | -1 = queued > 0 ? 1 : -1;
        queued -= dir;
        await go(dir, 0.5);
      }
      schedule();
    }

    const start = async () => {
      if (scene || starting || disposed) return;
      starting = true;
      try {
        // Draw once the page fonts are ready, so the type on the pages is the real typeface.
        if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]);
        if (disposed) return;
        // Sharper pages on large screens; lighter ones on phones.
        const pageWidth = window.innerWidth < 720 ? 1000 : 1400;
        pages = Array.from({ length: PAGES }, (_, i) => drawPage(i, pageWidth));
        scene = createBookScene(element, RATIO, () => {
          if (!disposed) setFailed(true);
        });
        scene.configure(lookRef.current === "studio" ? STUDIO_LOOK : SIMPLE_LOOK);
        scene.viewport(false, 1, focusOf(0));
        scene.show(facesOf(0));
        setReady(true);
        schedule();
      } catch {
        scene?.dispose();
        scene = null;
        setFailed(true);
      } finally {
        starting = false;
      }
    };

    controls.current = {
      setLook: (next) => scene?.configure(next === "studio" ? STUDIO_LOOK : SIMPLE_LOOK),
      manual: (dir) => {
        if (timer) clearTimeout(timer);
        if (busy) {
          queued = Math.max(-MAX_QUEUE, Math.min(MAX_QUEUE, queued + dir));
          return;
        }
        void go(dir).then(drain);
      },
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) {
          void start();
          schedule();
        } else if (timer) clearTimeout(timer);
      },
      { threshold: 0.2 },
    );
    observer.observe(wrap.current!);

    return () => {
      disposed = true;
      controls.current = null;
      if (timer) clearTimeout(timer);
      observer.disconnect();
      scene?.dispose();
      scene = null;
    };
  }, []);

  return (
    <div ref={wrap} className={className ?? "mx-auto w-full max-w-5xl"}>
      <div className="relative overflow-hidden rounded-3xl shadow-lift" style={{ background: MIDNIGHT }}>
        <div ref={host} role="img" aria-label="A colourful example flipbook turning its pages in studio lighting" className="h-[22rem] w-full sm:h-[30rem] lg:h-[34rem]" />
        {!ready && !failed && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/60">Loading example…</p>
        )}
        {failed && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/70">
            The animated example needs 3D graphics, which aren’t available on this device. The real flipbook still lets you read every page.
          </p>
        )}
      </div>
      {!failed && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Segmented
            label="Example appearance"
            value={look}
            options={[["simple", "Simple"], ["studio", "Studio"]] as const}
            onChange={(next) => {
              lookRef.current = next;
              setLook(next);
              controls.current?.setLook(next);
            }}
          />
          <button
            type="button"
            onClick={() => controls.current?.manual(-1)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 text-xs hover:border-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden /> Previous
          </button>
          <button
            type="button"
            onClick={() => controls.current?.manual(1)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-4 py-1.5 text-xs hover:border-foreground"
          >
            Next <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
