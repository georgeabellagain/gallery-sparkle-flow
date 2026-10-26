import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getBlob } from "@/lib/portfolia/assets";
import { stickerInfo, type PageSlideshow, type PageSticker } from "@/lib/portfolia/page-extras";
import { AnimatedSticker } from "./AnimatedSticker";

/** Width of a page's sticker layer; turning pages are seen in motion, so it need not match the print's detail. */
const LAYER_WIDTH = 800;

const stickerPictures = new Map<string, HTMLImageElement | null>();
const slidePictures = new Map<string, ImageBitmap | null>();
const loading = new Map<string, Promise<void>>();
const once = (key: string, load: () => Promise<void>) => {
  let p = loading.get(key);
  if (!p) { p = load(); loading.set(key, p); }
  return p;
};

/** A sticker's still drawing as a picture, made from the same artwork the page shows moving. */
async function loadSticker(sticker: PageSticker["sticker"], colour: string) {
  const key = `${sticker}:${colour}`;
  return once(`sticker:${key}`, async () => {
    // Drawn outside React's own work, so the drawing can be read straight away.
    await Promise.resolve();
    const host = document.createElement("div");
    const root = createRoot(host);
    flushSync(() => root.render(<AnimatedSticker sticker={sticker} colour={colour} still />));
    const svg = host.querySelector("svg")?.cloneNode(true) as SVGSVGElement | undefined;
    root.unmount();
    if (!svg) { stickerPictures.set(key, null); return; }
    svg.setAttribute("width", "256");
    svg.setAttribute("height", "256");
    svg.setAttribute("color", colour);
    svg.removeAttribute("class");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      stickerPictures.set(key, img);
    } catch {
      stickerPictures.set(key, null);
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}

/** A slideshow's first picture, shown on the turning page in place of the playing slideshow. */
async function loadSlide(imageKey: string) {
  return once(`slide:${imageKey}`, async () => {
    try {
      const blob = await getBlob(imageKey);
      slidePictures.set(imageKey, blob ? await createImageBitmap(blob) : null);
    } catch {
      slidePictures.set(imageKey, null);
    }
  });
}

/** Loads everything the layers need, so drawing them can be done at once when a page asks. */
export function loadPageLayerPictures(stickers: PageSticker[], slideshows: PageSlideshow[]) {
  return Promise.all([
    ...stickers.map((s) => loadSticker(s.sticker, s.colour)),
    ...slideshows.flatMap((s) => (s.images[0] ? [loadSlide(s.images[0])] : [])),
  ]);
}

type Pose = { dx?: number; dy?: number; sx?: number; sy?: number; rotate?: number; alpha?: number; origin?: [number, number] };
const TAU = Math.PI * 2;
/**
 * Where a sticker is in its motion `t` seconds in: the same loops as the .pf-sticker-* animations in styles.css
 * (offsets as shares of the sticker's size, turns in degrees), so a sticker turning with its page keeps moving as
 * it does on the still page. Both run from the page's clock, so they line up when one hands over to the other.
 */
export function stickerPose(motion: string, t: number): Pose {
  const loop = (period: number) => (((t % period) + period) % period) / period;
  const swell = (period: number) => 0.5 - 0.5 * Math.cos(TAU * loop(period)); // 0 → 1 → 0
  const within = (p: number, from: number, to: number) => (p >= from && p <= to ? Math.sin(((p - from) / (to - from)) * Math.PI) : 0);
  switch (motion) {
    case "nudge": return { dx: 0.14 * swell(1.4) };
    case "nudge-left": return { dx: -0.14 * swell(1.4) };
    case "nudge-up": { const w = swell(1.4); return { dx: 0.1 * w, dy: -0.1 * w }; }
    case "rise": return { dy: -0.14 * swell(1.2) };
    case "bounce": return { dy: 0.14 * swell(1.2) };
    case "pulse": { const w = swell(1.8); return { sx: 1 + 0.14 * w, sy: 1 + 0.14 * w, alpha: 1 - 0.2 * w }; }
    case "beat": { const p = loop(1.3), s = p < 0.6 ? 1 + 0.15 * Math.max(0, Math.sin((p / 0.6) * TAU * 1.5)) : 1; return { sx: s, sy: s }; }
    case "spin": return { rotate: 360 * loop(6) };
    case "twinkle": { const w = swell(1.6); return { sx: 1 - 0.18 * w, sy: 1 - 0.18 * w, rotate: 12 * w, alpha: 1 - 0.4 * w }; }
    case "tap": { const s = 1 - 0.15 * within(loop(1.5), 0.7, 0.9); return { sx: s, sy: s, origin: [0.3, 0.3] }; }
    case "wiggle": return { rotate: 12 * Math.sin(TAU * loop(1.6)), origin: [0.6, 0.9] };
    case "flash": return { alpha: loop(1.8) < 0.5 ? 1 : 0.35 };
    case "draw": return { alpha: 0.55 + 0.45 * swell(2.6) };
    case "pop": { const p = loop(2.2), b = within(p, 0.55, 0.85); return { sx: 1 + 0.18 * b, sy: 1 + 0.18 * b, rotate: -6 * b }; }
    case "swing": return { rotate: 11 * Math.sin(TAU * loop(2)), origin: [0.85, 0.15] };
    case "ring": { const p = loop(2.4); return { rotate: p < 0.35 ? 14 * Math.sin((TAU * p) / 0.1) * (1 - p / 0.35) : 0, origin: [0.5, 0.1] }; }
    case "shake": { const p = loop(2.2), on = p < 0.3 ? Math.sin((TAU * p) / 0.1) : 0; return { dx: 0.03 * on, rotate: 6 * on }; }
    case "drop": { const p = loop(2.4); return { dy: p < 0.15 ? -0.3 * (1 - p / 0.15) : 0, alpha: p < 0.15 ? p / 0.15 : p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1, origin: [0.5, 1] }; }
    case "flicker": { const s = Math.sin(TAU * loop(1.4)); return { sx: 1 - 0.05 * s, sy: 1 + 0.07 * s, rotate: -2 * s, origin: [0.5, 1] }; }
    default: return {};
  }
}

/**
 * The stickers and slideshows of one page face on a transparent picture the shape of the page. The book shows it on
 * the paper while their live copies (which sit flat over the page) are away, so they turn with the page. Drawn again
 * into the same `canvas` with a `time`, the stickers move as they do on the page.
 */
export function drawPageLayer(stickers: PageSticker[], slideshows: PageSlideshow[], ratio: number, canvas?: HTMLCanvasElement, time?: number): HTMLCanvasElement | null {
  if (!stickers.length && !slideshows.length) return null;
  canvas ??= document.createElement("canvas");
  if (!canvas.width || canvas.width !== LAYER_WIDTH) { canvas.width = LAYER_WIDTH; canvas.height = Math.round(LAYER_WIDTH * ratio); }
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  for (const s of slideshows) {
    const x = s.x * w, y = s.y * h, bw = s.width * w, bh = s.height * h;
    const picture = s.images[0] ? slidePictures.get(s.images[0]) : null;
    if (!picture) { ctx.fillStyle = "rgba(0,0,0,0.05)"; ctx.fillRect(x, y, bw, bh); continue; }
    const scale = (s.fit === "cover" ? Math.max : Math.min)(bw / picture.width, bh / picture.height);
    const pw = picture.width * scale, ph = picture.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, bw, bh);
    ctx.clip();
    ctx.drawImage(picture, x + (bw - pw) / 2, y + (bh - ph) / 2, pw, ph);
    ctx.restore();
  }
  for (const s of stickers) {
    const picture = stickerPictures.get(`${s.sticker}:${s.colour}`);
    if (!picture) continue;
    const size = s.size * w;
    if (time === undefined) { ctx.drawImage(picture, s.x * w, s.y * h, size, size); continue; }
    const { dx = 0, dy = 0, sx = 1, sy = 1, rotate = 0, alpha = 1, origin = [0.5, 0.5] } = stickerPose(stickerInfo(s.sticker)?.motion ?? "pulse", time);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(s.x * w + (dx + origin[0]) * size, s.y * h + (dy + origin[1]) * size);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(sx, sy);
    ctx.drawImage(picture, -origin[0] * size, -origin[1] * size, size, size);
    ctx.restore();
  }
  return canvas;
}
