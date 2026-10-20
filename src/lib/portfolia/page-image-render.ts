import type { PDFDocumentProxy } from "pdfjs-dist";
import { pageImagePixels, PAGE_IMAGE_SIZES, type PageImageFormat, type PageImageLink, type PageImageSize, type StoredPageText } from "./page-images";

/**
 * Draws PDF pages as page pictures. Runs in a worker with OffscreenCanvas (page-images.worker.ts), or on the main
 * thread where a worker cannot run pdf.js. The largest size is drawn once and the smaller one is scaled from it,
 * and the page's text is saved too, so a visitor needs the PDF only to zoom in beyond the pictures.
 */

export type RenderedPageImages = {
  page: number;
  w: number;
  h: number;
  links: PageImageLink[];
  images: { size: PageImageSize; width: number; height: number; blob: Blob }[];
  /** The page's selectable text (StoredPageText as JSON), or null when it has none. */
  text: Blob | null;
};

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function makeCanvas(width: number, height: number): { canvas: AnyCanvas; context: AnyContext } {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (context) return { canvas, context };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can’t draw page pictures.");
  return { canvas, context };
}

/** pdf.js asks for scratch canvases (masks, patterns); a worker has no document, so they are OffscreenCanvases. */
export class OffscreenCanvasFactory {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    return makeCanvas(width, height);
  }
  reset(item: { canvas: AnyCanvas }, width: number, height: number) {
    item.canvas.width = width; item.canvas.height = height;
  }
  destroy(item: { canvas: AnyCanvas | null; context: AnyContext | null }) {
    if (item.canvas) item.canvas.width = item.canvas.height = 0;
    item.canvas = null; item.context = null;
  }
}

/** Transfer maps and high-contrast filters need SVG; page pictures are drawn without them. */
export class NoFilterFactory {
  addFilter() { return "none"; }
  addHCMFilter() { return "none"; }
  addAlphaFilter() { return "none"; }
  addLuminosityFilter() { return "none"; }
  addHighlightHCMFilter() { return "none"; }
  destroy() {}
}

const QUALITY: Record<PageImageFormat, number[]> = { webp: [0.82, 0.6], jpg: [0.85, 0.65] };
const MIME: Record<PageImageFormat, string> = { webp: "image/webp", jpg: "image/jpeg" };
/**
 * Photo pages are far smaller (about 100 KB at 1600 and 180 KB at 2560). Extremely detailed artwork above these is
 * encoded once more at a lower quality, so a heavy page stays quicker to open; one retry keeps publishing quick.
 */
export const PAGE_IMAGE_BUDGET: Record<PageImageSize, number> = { 1600: 400 * 1024, 2560: 900 * 1024 };

async function encode(canvas: AnyCanvas, format: PageImageFormat, quality = QUALITY[format][0]!): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: MIME[format], quality });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t encode a page picture."))), MIME[format], quality));
}

async function encodeWithin(canvas: AnyCanvas, format: PageImageFormat, budget: number): Promise<Blob> {
  let blob = await encode(canvas, format);
  for (const quality of QUALITY[format].slice(1)) {
    if (blob.size <= budget) break;
    blob = await encode(canvas, format, quality);
  }
  return blob;
}

/** Safari draws canvases but cannot encode WebP from them: it hands back a PNG instead, so JPEG is used there. */
export async function chooseFormat(): Promise<PageImageFormat> {
  try {
    const { canvas } = makeCanvas(2, 2);
    const blob = await encode(canvas, "webp");
    return blob.type === "image/webp" ? "webp" : "jpg";
  } catch {
    return "jpg";
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/** The PDF's own web links on a page, as fractions of the page, so visitors can follow them before the PDF loads. */
async function pageLinks(page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>, viewport: { width: number; height: number; convertToViewportRectangle(r: number[]): number[] }): Promise<PageImageLink[]> {
  const annotations = await page.getAnnotations().catch(() => []);
  const links: PageImageLink[] = [];
  for (const a of annotations as { subtype?: string; url?: string; rect?: number[] }[]) {
    if (a.subtype !== "Link" || !a.url || !/^(https?:|mailto:)/i.test(a.url) || !a.rect) continue;
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect) as [number, number, number, number];
    const x = Math.min(x1, x2) / viewport.width, y = Math.min(y1, y2) / viewport.height;
    const w = Math.abs(x2 - x1) / viewport.width, h = Math.abs(y2 - y1) / viewport.height;
    if (w <= 0 || h <= 0) continue;
    links.push({ url: a.url.slice(0, 2048), x: round(x), y: round(y), w: round(w), h: round(h) });
    if (links.length >= 200) break;
  }
  return links;
}

const short = (n: unknown) => (typeof n === "number" ? Math.round(n * 1000) / 1000 : n);

/**
 * The page's selectable text, kept beside its pictures so visitors never download the PDF for it. Null when the
 * page has none (a scanned or picture-only page).
 */
async function pageText(page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>): Promise<Blob | null> {
  const content = await page.getTextContent().catch(() => null);
  if (!content || !content.items.some((item) => "str" in item && item.str.trim())) return null;
  const items = content.items.map((item) => "str" in item
    ? { str: item.str, dir: item.dir, width: short(item.width), height: short(item.height), transform: item.transform.map(short), fontName: item.fontName, hasEOL: item.hasEOL }
    : item);
  const stored: StoredPageText = { v: 1, view: page.view.map((v) => short(v) as number) as StoredPageText["view"], rotate: page.rotate, items, styles: content.styles as Record<string, unknown>, lang: content.lang ?? null };
  return new Blob([JSON.stringify(stored)], { type: "application/json" });
}

/** Draws one page at every size. `format` comes from chooseFormat(). */
export async function renderPageImages(doc: PDFDocumentProxy, n: number, format: PageImageFormat, sizes: readonly PageImageSize[] = PAGE_IMAGE_SIZES): Promise<RenderedPageImages> {
  const page = await doc.getPage(n);
  try {
    const base = page.getViewport({ scale: 1 });
    const ordered = [...sizes].sort((a, b) => b - a);
    const [bigW, bigH] = pageImagePixels(base.width, base.height, ordered[0]!);
    const big = makeCanvas(bigW, bigH);
    big.context.fillStyle = "#ffffff";
    big.context.fillRect(0, 0, bigW, bigH);
    const viewport = page.getViewport({ scale: bigW / base.width });
    await page.render({ canvasContext: big.context as CanvasRenderingContext2D, viewport, background: "#ffffff" }).promise;
    const images: RenderedPageImages["images"] = [];
    for (const size of ordered) {
      const [w, h] = pageImagePixels(base.width, base.height, size);
      let target = big;
      if (w !== bigW || h !== bigH) {
        target = makeCanvas(w, h);
        target.context.imageSmoothingEnabled = true;
        target.context.imageSmoothingQuality = "high";
        target.context.drawImage(big.canvas, 0, 0, w, h);
      }
      images.push({ size, width: w, height: h, blob: await encodeWithin(target.canvas, format, PAGE_IMAGE_BUDGET[size]) });
      if (target !== big) target.canvas.width = target.canvas.height = 0;
    }
    big.canvas.width = big.canvas.height = 0;
    return { page: n, w: base.width, h: base.height, links: await pageLinks(page, base), images: images.sort((a, b) => a.size - b.size), text: await pageText(page) };
  } finally {
    page.cleanup();
  }
}
