import type { PDFDocumentProxy } from "pdfjs-dist";
import { SHARE_HEIGHT, SHARE_WIDTH } from "./share-image";

/** Render once in the uploader's browser, with the whole cover visible. */
export async function renderCover(doc: PDFDocumentProxy): Promise<Blob> {
  const page = await doc.getPage(1);
  const size = page.getViewport({ scale: 1 });
  const scale = Math.min((SHARE_WIDTH - 48) / size.width, (SHARE_HEIGHT - 48) / size.height);
  const viewport = page.getViewport({ scale });
  const sheet = document.createElement("canvas");
  sheet.width = Math.ceil(viewport.width);
  sheet.height = Math.ceil(viewport.height);
  const sheetContext = sheet.getContext("2d");
  if (!sheetContext) throw new Error("Could not render cover");
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  try {
    await page.render({ canvasContext: sheetContext, viewport, background: "#ffffff" }).promise;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render cover");
    ctx.fillStyle = "#f4f3ef";
    ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
    ctx.drawImage(sheet, (SHARE_WIDTH - sheet.width) / 2, (SHARE_HEIGHT - sheet.height) / 2);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not encode cover")), "image/jpeg", 0.88));
  } finally {
    sheet.width = sheet.height = canvas.width = canvas.height = 0;
    page.cleanup();
  }
}
