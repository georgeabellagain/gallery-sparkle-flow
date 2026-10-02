import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bookFocus, bookLayout } from "@/lib/portfolia/book-layout";
import { createBookScene, type BookFaces, type BookScene, type StudioSettings } from "@/lib/portfolia/book-scene";

const MIDNIGHT = "#191d3a";
const PAGE_W = 900;
const PAGE_H = 1272;
const RATIO = PAGE_H / PAGE_W;
const PAGES = 10;
const layout = bookLayout(PAGES, false);

/** The same studio look a visitor gets in the real flipbook, on midnight blue. */
const LOOK: StudioSettings = {
  studio: true,
  material: "satin",
  brightness: 0.7,
  hdri: "softbox",
  hdriRotation: 0,
  backdrop: "",
  backdropColor: MIDNIGHT,
  backdropKind: "tile",
  backdropAspect: 1,
  backdropScale: 1,
  backdropX: 0,
  backdropY: 0,
};

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
function drawPage(n: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d")!;
  const [a, b, c] = PALETTES[n % PALETTES.length]!;
  const kind = n % 3;
  const diagonal = (from: string, to: string, x0 = 0, y0 = 0, x1 = PAGE_W, y1 = PAGE_H) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  };

  if (kind === 0) {
    ctx.fillStyle = diagonal(a, b);
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.22;
    circle(ctx, 700, 260, 280);
    circle(ctx, 120, 980, 360);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = c;
    circle(ctx, 330, 560, 170);
    ctx.globalAlpha = 1;
  } else if (kind === 1) {
    ctx.fillStyle = "#fffaf3";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.save();
    roundedRect(ctx, 70, 230, 760, 640, 30);
    ctx.clip();
    ctx.fillStyle = diagonal(a, c, 70, 230, 830, 870);
    ctx.fillRect(70, 230, 760, 640);
    ctx.fillStyle = b;
    circle(ctx, 560, 470, 190);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    circle(ctx, 300, 700, 230);
    ctx.globalAlpha = 1;
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
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = b;
    ctx.fillRect(0, PAGE_H * 0.46, PAGE_W, PAGE_H);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(PAGE_W / 2, PAGE_H * 0.46, 250, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let i = 0; i < 4; i++) ctx.fillRect(70, 880 + i * 38, 760 - i * 120, 14);
  }

  ctx.fillStyle = kind === 1 ? "#1b1b2f" : "#ffffff";
  ctx.font = "30px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(`PORTFOLIA / ${String(n + 1).padStart(2, "0")}`, 70, 100);
  ctx.font = "104px 'Instrument Serif', Georgia, serif";
  ctx.fillText(TITLES[n % TITLES.length]!, 70, kind === 1 ? 190 : PAGE_H - 120);
  return canvas;
}

/**
 * A self-playing studio flipbook for the homepage. It only starts when it
 * scrolls into view and pauses when it leaves, so it costs nothing elsewhere.
 */
export function StudioDemo() {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ manual: (dir: 1 | -1) => void } | null>(null);
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
    let spread = 0;
    let direction: 1 | -1 = 1;
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

    const go = async (dir: 1 | -1) => {
      const next = spread + dir;
      if (!scene || busy || next < 0 || next >= layout.spreads.length) return;
      busy = true;
      try {
        await scene.turn(facesOf(spread), facesOf(next), dir, focusOf(next));
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
        schedule();
      }, 2600);
    };

    const start = () => {
      if (scene || disposed) return;
      try {
        pages = Array.from({ length: PAGES }, (_, i) => drawPage(i));
        scene = createBookScene(element, RATIO, () => {
          if (!disposed) setFailed(true);
        });
        scene.configure(LOOK);
        scene.viewport(false, 1, focusOf(0));
        scene.show(facesOf(0));
        setReady(true);
      } catch {
        scene?.dispose();
        scene = null;
        setFailed(true);
      }
    };

    controls.current = {
      manual: (dir) => {
        if (timer) clearTimeout(timer);
        void go(dir).then(schedule);
      },
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) {
          start();
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
    <div ref={wrap} className="mx-auto w-full max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl shadow-lift" style={{ background: MIDNIGHT }}>
        <div ref={host} role="img" aria-label="A colourful example flipbook turning its pages in studio lighting" className="h-[22rem] w-full sm:h-[32rem]" />
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
        <div className="mt-4 flex items-center justify-center gap-3">
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
