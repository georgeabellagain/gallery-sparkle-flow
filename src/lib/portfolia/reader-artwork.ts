import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfjs } from "./pdf";
import { createPreparedCache } from "./prepared-cache";
import { createRenderQueue } from "./render-queue";

export type ReaderArtwork = { canvas: HTMLCanvasElement; text: HTMLDivElement; links: HTMLDivElement; scale: number };
const documents = new WeakMap<PDFDocumentProxy, ReturnType<typeof readerCache>>();
const keyFor = (page: number, width: number) => `${page}:${width}:${Math.min(window.devicePixelRatio || 1, 2)}`;
function readerCache() {
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return {
    cache: createPreparedCache<string, ReaderArtwork>((memory <= 4 ? 48 : 96) * 1024 * 1024, art => art.canvas.width * art.canvas.height * 4),
    queue: createRenderQueue(2),
  };
}
function state(doc: PDFDocumentProxy) {
  let value = documents.get(doc);
  if (!value) { value = readerCache(); documents.set(doc, value); }
  return value;
}
export function cachedReaderArtwork(doc: PDFDocumentProxy, page: number, width: number) {
  return documents.get(doc)?.cache.get(keyFor(page, width));
}

/** Unlit HD artwork plus its selectable text and clickable links, prepared once. */
export function prepareReaderArtwork(doc: PDFDocumentProxy, n: number, size: { w: number; h: number }, cssWidth: number) {
  const store = state(doc);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return store.cache.load(`${n}:${cssWidth}:${dpr}`, () => store.queue.enqueue(async () => {
    const pdfjs = await loadPdfjs();
    const page = await doc.getPage(n);
    const scale = cssWidth / size.w;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * dpr); canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    const text = document.createElement("div"); text.className = "textLayer";
    const links = document.createElement("div"); links.className = "absolute inset-0";
    const task = page.render({ canvasContext: canvas.getContext("2d")!, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport });
    // These three independent PDF operations used to block one another.
    const metadata = page.getAnnotations().then(annotations => {
      for (const annotation of annotations) {
        if (annotation.subtype !== "Link" || !annotation.url) continue;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect);
        const link = document.createElement("a");
        link.href = annotation.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.title = annotation.url;
        link.className = "absolute hover:bg-foreground/5 focus-visible:outline-2";
        Object.assign(link.style, { left: `${Math.min(x1!, x2!)}px`, top: `${Math.min(y1!, y2!)}px`, width: `${Math.abs(x2! - x1!)}px`, height: `${Math.abs(y2! - y1!)}px` });
        links.append(link);
      }
    });
    try { await Promise.all([task.promise, layer.render(), metadata]); }
    catch (error) { task.cancel(); layer.cancel(); throw error; }
    return { canvas, text, links, scale };
  }));
}

/** A fresh DOM presentation; the cached master remains immutable and reusable. */
export function copyReaderArtwork(art: ReaderArtwork) {
  const canvas = document.createElement("canvas");
  canvas.width = art.canvas.width; canvas.height = art.canvas.height;
  canvas.style.width = canvas.style.height = "100%"; canvas.setAttribute("aria-hidden", "true");
  canvas.getContext("2d")!.drawImage(art.canvas, 0, 0);
  return { canvas, layers: [art.text.cloneNode(true) as HTMLElement, art.links.cloneNode(true) as HTMLElement], scale: art.scale };
}
