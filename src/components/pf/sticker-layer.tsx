import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getBlob } from "@/lib/portfolia/assets";
import type { PageSlideshow, PageSticker } from "@/lib/portfolia/page-extras";
import { AnimatedSticker } from "./AnimatedSticker";

/** Width of a page's sticker layer; turning pages are seen in motion, so it need not match the print's detail. */
const LAYER_WIDTH = 1024;

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

/**
 * The stickers and slideshows of one page face, drawn still on a transparent picture the shape of the page. The book
 * shows it on the paper while their moving copies (which sit flat over the page) are away, so they turn with the page.
 */
export function drawPageLayer(stickers: PageSticker[], slideshows: PageSlideshow[], ratio: number): HTMLCanvasElement | null {
  if (!stickers.length && !slideshows.length) return null;
  const canvas = document.createElement("canvas");
  canvas.width = LAYER_WIDTH;
  canvas.height = Math.round(LAYER_WIDTH * ratio);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const w = canvas.width, h = canvas.height;
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
    if (picture) ctx.drawImage(picture, s.x * w, s.y * h, s.size * w, s.size * w);
  }
  return canvas;
}
