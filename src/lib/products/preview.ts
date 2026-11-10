import { loadPdfjs } from "../portfolia/pdf";
/** Rebuild from selected raster pages, never copy original PDF objects. This
 * excludes hidden pages, attachments, outlines, annotations and shared resources. */
export async function buildProductPreview(
  file: Blob,
  pages: number[],
  progress: (n: number) => void = () => {},
) {
  if (!pages.length || pages.length > 40) throw new Error("Choose 1–40 preview pages.");
  const pdfjs = await loadPdfjs();
  const original = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise;
  try {
    if (pages.some((p) => !Number.isInteger(p) || p < 1 || p > original.numPages))
      throw new Error("Invalid preview page.");
    const { PDFDocument } = await import("pdf-lib");
    const output = await PDFDocument.create();
    for (let i = 0; i < pages.length; i++) {
      const page = await original.getPage(pages[i]!);
      const size = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1800 / Math.max(size.width, size.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport, background: "white" })
        .promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not render preview"))),
          "image/jpeg",
          0.9,
        ),
      );
      const image = await output.embedJpg(await blob.arrayBuffer());
      const target = output.addPage([size.width, size.height]);
      target.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
      canvas.width = canvas.height = 1;
      page.cleanup();
      progress((i + 1) / pages.length);
    }
    output.setTitle("Product preview");
    output.setAuthor("Portfolia");
    return new Blob([new Uint8Array(await output.save())], { type: "application/pdf" });
  } finally {
    await original.destroy();
  }
}
export async function deliverySheet(title: string, url: string) {
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString } = await import("pdf-lib");
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[^\x20-\x7e]/g, " ");
  page.drawText("PORTFOLIA / YOUR DIGITAL EDITION", {
    x: 48,
    y: 770,
    size: 12,
    font: bold,
    color: rgb(0.22, 0.35, 0.29),
  });
  page.drawText(clean(title).slice(0, 52), { x: 48, y: 710, size: 20, font: bold });
  const lines = [
    "Thank you for your purchase.",
    "Open your interactive edition using the button below.",
    "If the seller enables downloads, you can also save the PDF.",
  ];
  lines.forEach((line, i) => page.drawText(line, { x: 48, y: 665 - i * 24, size: 12, font }));
  page.drawRectangle({ x: 48, y: 520, width: 260, height: 46, color: rgb(0.12, 0.19, 0.16) });
  page.drawText("OPEN YOUR DIGITAL EDITION", {
    x: 67,
    y: 537,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });
  const link = pdf.context.register(
    pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [48, 520, 308, 566],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    }),
  );
  page.node.set(PDFName.of("Annots"), pdf.context.obj([link]));
  page.drawText("If the button does not work, copy this complete address:", {
    x: 48,
    y: 470,
    size: 11,
    font,
  });
  for (let i = 0; i < url.length; i += 70)
    page.drawText(url.slice(i, i + 70), { x: 48, y: 445 - Math.floor(i / 70) * 18, size: 9, font });
  [
    "Keep this customer link private. Anyone with it can open the edition.",
    "For help with your purchase, contact the seller through your shop order.",
    "Portfolia hosts the reader; your purchase is handled by the seller's shop.",
  ].forEach((line, i) => page.drawText(line, { x: 48, y: 335 - i * 22, size: 10, font }));
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
