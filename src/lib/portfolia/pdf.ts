import { putBlob, uid } from "./assets";
import { UPLOAD_LIMIT, UPLOAD_LIMIT_MB, type PdfFile } from "./store";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs() {
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

export function describePdfError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === "PasswordException")
    return "This PDF is password protected. Export an unprotected copy and upload that instead.";
  if (name === "InvalidPDFException")
    return "This file couldn’t be read as a PDF. It may be damaged — try exporting it again.";
  return "This PDF couldn’t be opened. Try exporting it again from your design software.";
}

/**
 * Validates a PDF (type, size, readable, not password protected) and stores it
 * in this browser. Nothing is changed if any step fails.
 */
export async function acceptPdf(file: File, onPhase?: (p: string) => void): Promise<PdfFile> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("That file isn’t a PDF. Portfolia only hosts PDF portfolios.");
  if (file.size > UPLOAD_LIMIT)
    throw new Error(
      `This PDF is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${UPLOAD_LIMIT_MB} MB — try exporting with compressed images.`,
    );
  onPhase?.("Checking your PDF");
  const buf = await file.arrayBuffer();
  const pdfjs = await loadPdfjs();
  let pages = 0;
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    pages = doc.numPages;
    void doc.destroy();
  } catch (e) {
    throw new Error(describePdfError(e));
  }
  onPhase?.("Saving in this browser");
  const blobKey = uid("pdf");
  try {
    await putBlob(blobKey, new Blob([buf], { type: "application/pdf" }));
  } catch {
    throw new Error("Your browser’s storage is full or blocked, so the PDF couldn’t be saved. Free some space and try again.");
  }
  return { blobKey, name: file.name, bytes: file.size, pages, uploadedAt: Date.now() };
}
