/**
 * Feature D: "Licensed to <buyer>" printed small at the foot of every page of a customer's download. A deterrent, not
 * copy protection. Pure pdf-lib, so it runs in the Worker (files up to STAMP_SERVER_LIMIT_BYTES) and in the browser.
 */
export const stampLine = (stamp: string) => `Licensed to ${stamp}`;
/** Helvetica can only draw printable ASCII: anything else becomes a space (as in deliverySheet). */
export const cleanStamp = (text: string) => text.replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();

export async function stampPdf(bytes: Uint8Array, stamp: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const text = cleanStamp(stampLine(stamp));
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 7, width = font.widthOfTextAtSize(text, size);
  for (const page of pdf.getPages()) {
    const { width: w } = page.getSize();
    const { x: left, y: bottom } = page.getCropBox?.() ?? { x: 0, y: 0 };
    page.drawText(text, { x: left + (w - width) / 2, y: bottom + 14, size, font, color: rgb(0.45, 0.45, 0.45), opacity: 0.85 });
  }
  pdf.setSubject(text);
  return pdf.save();
}
