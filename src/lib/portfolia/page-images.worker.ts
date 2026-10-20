import { chooseFormat, NoFilterFactory, OffscreenCanvasFactory, renderPageImages } from "./page-image-render";

/**
 * Draws a PDF's page pictures off the main thread, so publishing never freezes the editor. Pages are posted back
 * one at a time and the main thread uploads each while the next is drawn; it hands out a credit per finished
 * upload, so a long book never piles up pictures in memory.
 */
type Message = { type: "start"; buffer: ArrayBuffer; credit: number } | { type: "credit" };
const scope = self as unknown as { fonts?: FontFaceSet; postMessage(message: unknown): void; onmessage: ((event: MessageEvent<Message>) => void) | null };

let credit = 0;
let wake: (() => void) | null = null;
const take = async () => {
  while (credit <= 0) await new Promise<void>((resolve) => { wake = resolve; });
  credit--;
};

async function run(buffer: ArrayBuffer) {
  try {
    // Embedded fonts are installed in the worker's own font set, which its OffscreenCanvases draw with.
    if (typeof OffscreenCanvas === "undefined" || !scope.fonts) throw new Error("unsupported");
    const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      CanvasFactory: OffscreenCanvasFactory,
      FilterFactory: NoFilterFactory,
      ownerDocument: { fonts: scope.fonts } as unknown as Document,
      isOffscreenCanvasSupported: true,
      useWorkerFetch: false,
    }).promise;
    try {
      const format = await chooseFormat();
      scope.postMessage({ type: "start", pages: doc.numPages, format });
      for (let n = 1; n <= doc.numPages; n++) {
        await take();
        scope.postMessage({ type: "page", result: await renderPageImages(doc, n, format) });
      }
      scope.postMessage({ type: "done" });
    } finally {
      await doc.destroy();
    }
  } catch (error) {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "unsupported" });
  }
}

scope.onmessage = (event) => {
  if (event.data.type === "start") {
    credit = event.data.credit;
    void run(event.data.buffer);
  } else {
    credit++;
    wake?.(); wake = null;
  }
};
