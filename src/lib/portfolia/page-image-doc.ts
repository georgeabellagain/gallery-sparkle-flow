import type { PDFDocumentProxy } from "pdfjs-dist";
import { pageImageDensity, pageImageKey, pickPageImage, type PageImages } from "./page-images";

/**
 * A published portfolio opens on its page pictures. This document stands in for pdf.js in the three readers: its
 * pages report the PDF's own sizes, draw the picture that suits the requested size, and carry the PDF's links from
 * the manifest. Nothing of the PDF is downloaded to show a page. The real PDF is streamed afterwards, only when
 * a reader wants selectable text (scroll and page by page) or zooms in beyond the pictures' detail.
 */

export type PageImageSource = {
  manifest: PageImages;
  /** The signed (or route) link for a picture's key. */
  url: (key: string) => string | undefined;
  /** New links once the hour-long signed ones have expired. */
  refresh: () => Promise<void>;
};

type Viewport = ReturnType<typeof viewportFor>;
type Doc = {
  manifest: PageImages;
  /** The streamed PDF, once something has asked for it. */
  pdf: () => Promise<PDFDocumentProxy | null>;
  /** The PDF if it is already open; deep zoom only uses it then, so a page is never held back for it. */
  openPdf: () => PDFDocumentProxy | null;
  onPdf: (listener: () => void) => () => void;
  texts: Map<string, Promise<HTMLDivElement | null>>;
};
const documents = new WeakMap<object, Doc>();

export const isPageImageDocument = (doc: object) => documents.has(doc);
/** The flipbook's image-detail check, read from the manifest instead of the PDF's image operators. */
export const presetDensity = (doc: object): number | undefined => {
  const d = documents.get(doc);
  return d ? pageImageDensity(d.manifest) : undefined;
};
/** 0 while pages come from pictures only; 1 once the PDF is open and deep zoom can draw from it. */
export const artworkVersion = (doc: object) => (documents.get(doc)?.openPdf() ? 1 : 0);
/** Asks for the PDF (for zoom beyond the pictures) and calls back once it is open. */
export function whenFullPdf(doc: object, listener: () => void): () => void {
  const d = documents.get(doc);
  if (!d) return () => {};
  void d.pdf();
  return d.onPdf(listener);
}

/** Text waits this long after the first pictures, so the PDF's opening requests never compete with them. */
const TEXT_DELAY_MS = 800;

/** The page's selectable text from the streamed PDF, drawn at `scale`; null when the PDF cannot be read. */
export async function pageImageText(doc: object, n: number, scale: number): Promise<HTMLDivElement | null> {
  const d = documents.get(doc);
  if (!d) return null;
  const id = `${n}:${scale.toFixed(4)}`;
  let made = d.texts.get(id);
  if (!made) {
    made = (async () => {
      if (!d.openPdf()) await new Promise((resolve) => setTimeout(resolve, TEXT_DELAY_MS));
      const pdf = await d.pdf().catch(() => null);
      if (!pdf) return null;
      // Loaded here, not at the top: resolution.ts reads this module in unit tests, which have no browser.
      const [pdfjs, page] = await Promise.all([import("./pdf").then((m) => m.loadPdfjs()), pdf.getPage(n)]);
      const viewport = page.getViewport({ scale });
      const div = document.createElement("div");
      div.className = "textLayer";
      await new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: div, viewport }).render();
      return div;
    })().catch(() => null);
    d.texts.set(id, made);
    while (d.texts.size > 40) d.texts.delete(d.texts.keys().next().value!);
  }
  const text = await made;
  // Each reader layer gets its own copy; the prepared one stays reusable.
  return text ? (text.cloneNode(true) as HTMLDivElement) : null;
}

/** The parts of pdf.js's PageViewport the readers use, for a page of `w` by `h` points without rotation. */
function viewportFor(w: number, h: number, scale: number) {
  const point = (x: number, y: number): [number, number] => [x * scale, (h - y) * scale];
  return {
    width: w * scale,
    height: h * scale,
    scale,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    viewBox: [0, 0, w, h],
    userUnit: 1,
    transform: [scale, 0, 0, -scale, 0, h * scale],
    rawDims: { pageWidth: w, pageHeight: h, pageX: 0, pageY: 0 },
    convertToViewportPoint: point,
    convertToViewportRectangle: (r: number[]) => [...point(r[0]!, r[1]!), ...point(r[2]!, r[3]!)],
    convertToPdfPoint: (x: number, y: number) => [x / scale, h - y / scale],
    clone: ({ scale: s = scale }: { scale?: number } = {}) => viewportFor(w, h, s),
  };
}

const cancelled = () => Object.assign(new Error("Rendering cancelled"), { name: "RenderingCancelledException" });
const emptyText = () => new ReadableStream({ start(controller) { controller.enqueue({ items: [], styles: {}, lang: null }); controller.close(); } });

/**
 * The stand-in document. `openPdf` opens the streamed PDF; it is called at most once, on demand.
 * Callers treat the result as a PDFDocumentProxy: it implements what PdfViewer, reader-artwork and BookView call.
 */
export function createPageImageDocument(source: PageImageSource, openPdf: () => Promise<PDFDocumentProxy>, { fetcher = fetch }: { fetcher?: typeof fetch } = {}) {
  const { manifest } = source;
  const reading = new AbortController();
  let opened: PDFDocumentProxy | null = null;
  let opening: Promise<PDFDocumentProxy | null> | null = null;
  let destroyed = false;
  const listeners = new Set<() => void>();
  const pdf = () => (opening ??= openPdf().then((doc) => {
    if (destroyed) { void doc.destroy(); return null; }
    opened = doc;
    listeners.forEach((l) => l());
    return doc;
  }, () => null));

  // Recently drawn pictures stay as compressed bytes, so a page that reappears (a turning sheet) is not fetched again.
  const bytes = new Map<string, Promise<Blob>>();
  const picture = (key: string) => {
    const hit = bytes.get(key);
    if (hit) { bytes.delete(key); bytes.set(key, hit); return hit; }
    const load = (async () => {
      let resigned = false;
      for (let attempt = 0; ; attempt++) {
        const url = source.url(key);
        const response = url ? await fetcher(url, { signal: reading.signal }).catch(() => null) : null;
        if (response?.ok) return response.blob();
        if (reading.signal.aborted) throw cancelled();
        const refused = !url || (response && [400, 401, 403].includes(response.status));
        // An expired link is signed again once; a picture still refused (storage says 400 for a missing one) is
        // left to the PDF, as is a 404.
        if (attempt >= 2 || response?.status === 404 || (refused && resigned)) throw new Error("A page picture couldn’t be loaded.");
        if (refused) { resigned = true; await source.refresh().catch(() => {}); }
        else await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    })();
    load.catch(() => bytes.delete(key));
    bytes.set(key, load);
    while (bytes.size > 24) bytes.delete(bytes.keys().next().value!);
    return load;
  };

  const pages = new Map<number, ReturnType<typeof makePage>>();
  const makePage = (n: number) => {
    const info = manifest.pages[n - 1]!;
    const largest = Math.max(...info.px.map(([w, h]) => Math.max(w, h)));
    return {
      pageNumber: n,
      rotate: 0,
      view: [0, 0, info.w, info.h],
      getViewport: ({ scale = 1 }: { scale?: number } = {}) => viewportFor(info.w, info.h, scale),
      getAnnotations: async () => (info.links ?? []).map((l) => ({
        subtype: "Link",
        url: l.url,
        rect: [l.x * info.w, info.h - (l.y + l.h) * info.h, (l.x + l.w) * info.w, info.h - l.y * info.h],
      })),
      streamTextContent: emptyText,
      getTextContent: async () => ({ items: [], styles: {}, lang: null }),
      getOperatorList: async () => ({ fnArray: [] as number[], argsArray: [] as unknown[] }),
      cleanup: () => true,
      render(params: { canvasContext: CanvasRenderingContext2D; viewport: Viewport; transform?: number[]; background?: string }) {
        let stopped = false;
        let inner: { cancel: () => void } | null = null;
        const t = params.transform ? Math.hypot(params.transform[0]!, params.transform[1]!) : 1;
        const canvas = params.canvasContext.canvas;
        const width = Math.min(canvas.width, Math.ceil(params.viewport.width * t));
        const height = Math.min(canvas.height, Math.ceil(params.viewport.height * t));
        const need = Math.max(width, height);
        const fromPdf = async (full: PDFDocumentProxy) => {
          const page = await full.getPage(n);
          if (stopped) throw cancelled();
          const task = page.render({ ...params, viewport: page.getViewport({ scale: params.viewport.scale }) } as Parameters<typeof page.render>[0]);
          inner = task;
          return task.promise;
        };
        const promise = (async () => {
          // Zoomed in beyond the pictures' detail: the PDF draws the page once it is open; until then the picture does.
          const full = need > largest * 1.2 ? opened : null;
          if (full) return fromPdf(full);
          const index = pickPageImage(info, need);
          let bitmap: ImageBitmap;
          try {
            const blob = await picture(pageImageKey(manifest.pdfKey, n, manifest.sizes[index]!, manifest.format));
            if (stopped) throw cancelled();
            bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" }).catch(() => createImageBitmap(blob));
          } catch (error) {
            // A picture that can't be loaded or decoded is drawn from the PDF instead, so the page still shows.
            if (stopped || (error as { name?: string })?.name === "RenderingCancelledException") throw error;
            const fallback = await pdf();
            if (stopped) throw cancelled();
            if (!fallback) throw error;
            return fromPdf(fallback);
          }
          if (stopped) { bitmap.close(); throw cancelled(); }
          const ctx = params.canvasContext;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = params.background ?? "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, width, height);
          ctx.restore();
          bitmap.close();
        })();
        return { promise, cancel: () => { stopped = true; inner?.cancel(); }, onContinue: undefined as unknown };
      },
    };
  };

  const doc = {
    numPages: manifest.pages.length,
    getPage: async (n: number) => {
      if (!Number.isInteger(n) || n < 1 || n > manifest.pages.length) throw new Error("Invalid page request.");
      let page = pages.get(n);
      if (!page) pages.set(n, (page = makePage(n)));
      return page;
    },
    destroy: async () => {
      destroyed = true;
      reading.abort();
      bytes.clear();
      listeners.clear();
      await opened?.destroy();
    },
  };
  documents.set(doc, { manifest, pdf, openPdf: () => opened, onPdf: (l) => (listeners.add(l), () => listeners.delete(l)), texts: new Map() });
  // Readers use it exactly as they use a pdf.js document.
  return doc as unknown as PDFDocumentProxy;
}
