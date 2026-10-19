import { putBlob, putLocalBlob, uid } from "./assets";
import { FREE_UPLOAD_LIMIT_MB, PREVIEW_LIMIT_MB, type PdfFile } from "./store";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
      const workerUrl = worker.default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })().catch((error) => {
      pdfjsPromise = null;
      throw error;
    });
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
 * With allowPreview, a PDF above the plan allowance (up to PREVIEW_LIMIT_MB) is kept in this browser only,
 * so people can see their book first; publishing asks them to make a smaller copy or upgrade.
 */
export async function acceptPdf(file: File, onPhase?: (p: string) => void, limitMb = FREE_UPLOAD_LIMIT_MB, { allowPreview = false } = {}): Promise<PdfFile> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("That file isn’t a PDF. Portfolia only hosts PDF portfolios.");
  const mb = (file.size / 1048576).toFixed(1);
  const overPlan = file.size > limitMb * 1024 * 1024;
  if (overPlan && (!allowPreview || file.size > PREVIEW_LIMIT_MB * 1024 * 1024))
    throw new Error(
      allowPreview
        ? `This PDF is ${mb} MB, too large to preview here (${PREVIEW_LIMIT_MB} MB maximum). Export a smaller web copy from your design app.`
        : `This PDF is ${mb} MB. Your plan allows up to ${limitMb} MB. Make a smaller web copy below, or upgrade for a larger allowance.`,
    );
  const save = overPlan ? putLocalBlob : putBlob;
  onPhase?.("Checking your PDF");
  const buf = await file.arrayBuffer();
  const pdfjs = await loadPdfjs();
  let pages = 0;
  let cover: Blob | undefined;
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    try {
      pages = doc.numPages;
      onPhase?.("Preparing link preview");
      const { renderCover } = await import("./cover");
      cover = await renderCover(doc).catch(() => undefined);
    } finally {
      await doc.destroy();
    }
  } catch (e) {
    throw new Error(describePdfError(e));
  }
  onPhase?.("Saving in this browser");
  const blobKey = uid("pdf");
  try {
    await save(blobKey, new Blob([buf], { type: "application/pdf" }));
  } catch {
    throw new Error("Your browser’s storage is full or blocked, so the PDF couldn’t be saved. Free some space and try again.");
  }
  let coverKey: string | undefined;
  if (cover) {
    const key = `${blobKey}_cover.jpg`;
    // A failed preview must never prevent an otherwise valid PDF upload.
    try { await save(key, cover); coverKey = key; } catch { /* text-only share card */ }
  }
  return { blobKey, ...(coverKey ? { coverKey } : {}), name: file.name, bytes: file.size, pages, uploadedAt: Date.now() };
}

