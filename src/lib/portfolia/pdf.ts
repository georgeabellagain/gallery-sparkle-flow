/**
 * Real PDF import. Pages are rendered to images for display; the original PDF
 * file is stored untouched alongside them.
 *
 * Honest limitation: pages are imported as intact page images. Text and vector
 * artwork inside a page are not converted into editable objects. Creators can
 * add overlays and clickable regions on top, or crop a region into its own item.
 */

import { putBlob, uid } from "./assets";

export interface PdfImportResult {
  pdfAssetId: string;
  pdfBlobKey: string;
  pdfName: string;
  pdfBytes: number;
  pages: {
    assetId: string;
    blobKey: string;
    pageNumber: number;
    width: number;
    height: number;
    bytes: number;
  }[];
}

type Progress = (info: { phase: string; page?: number; total?: number; percent: number }) => void;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

const MAX_PAGES = 40;
const TARGET_WIDTH = 1400;

export async function importPdf(file: File, onProgress: Progress): Promise<PdfImportResult> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("That file isn’t a PDF. Choose a .pdf file and try again.");
  }
  onProgress({ phase: "Reading file", percent: 4 });
  const buffer = await file.arrayBuffer();

  const pdfBlobKey = uid("blob");
  await putBlob(pdfBlobKey, new Blob([buffer], { type: "application/pdf" }));

  onProgress({ phase: "Opening document", percent: 10 });
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  } catch {
    throw new Error(
      "This PDF couldn’t be opened. It may be password protected or damaged. Nothing else in your portfolio was changed.",
    );
  }

  const total = Math.min(doc.numPages, MAX_PAGES);
  const pages: PdfImportResult["pages"] = [];
  const pdfAssetId = uid("as");

  for (let n = 1; n <= total; n++) {
    onProgress({
      phase: `Rendering page ${n} of ${total}`,
      page: n,
      total,
      percent: 12 + Math.round((n / total) * 84),
    });
    // Yield so the interface stays responsive between pages.
    await new Promise((r) => setTimeout(r, 0));
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, TARGET_WIDTH / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not render the PDF pages.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`Page ${n} could not be saved.`))),
        "image/jpeg",
        0.9,
      ),
    );
    const blobKey = uid("blob");
    await putBlob(blobKey, blob);
    pages.push({
      assetId: uid("as"),
      blobKey,
      pageNumber: n,
      width: canvas.width,
      height: canvas.height,
      bytes: blob.size,
    });
    page.cleanup();
  }

  onProgress({ phase: "Finishing", percent: 100 });
  return {
    pdfAssetId,
    pdfBlobKey,
    pdfName: file.name,
    pdfBytes: file.size,
    pages,
  };
}

export const pdfPageLimit = MAX_PAGES;
