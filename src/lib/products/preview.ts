import { loadPdfjs } from "../portfolia/pdf";
/** Rebuild from selected raster pages, never copy original PDF objects. This
 * excludes hidden pages, attachments, outlines, annotations and shared resources. */
export async function buildProductPreview(
  file: Blob,
  pages: number[],
  progress: (n: number) => void = () => {},
  watermark = false,
) {
  if (!pages.length || pages.length > 40) throw new Error("Choose 1–40 preview pages.");
  const pdfjs = await loadPdfjs();
  const original = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise;
  try {
    if (pages.some((p) => !Number.isInteger(p) || p < 1 || p > original.numPages))
      throw new Error("Invalid preview page.");
    const { PDFDocument } = await import("pdf-lib");
    const { StandardFonts, rgb, degrees } = await import("pdf-lib");
    const output = await PDFDocument.create();
    const mark = watermark ? await output.embedFont(StandardFonts.HelveticaBold) : null;
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
      if (mark) {
        // Subtle, widely spaced diagonal mark baked into the preview file: a soft light
        // letterform with a faint shadow, so it reads on light and dark artwork alike.
        const fs = Math.max(12, Math.min(size.width, size.height) / 18);
        const word = "PREVIEW", tw = mark.widthOfTextAtSize(word, fs);
        const a = Math.PI / 6, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
        const du = tw * 2.4, dv = fs * 7, reach = size.width + size.height;
        for (let j = -Math.ceil(reach / dv); j <= Math.ceil(reach / dv); j++)
          for (let i = -Math.ceil(reach / du); i <= Math.ceil(reach / du); i++) {
            const u = i * du + (j % 2 ? du / 2 : 0), v = j * dv;
            const x = size.width / 2 + u * ux + v * vx - (tw / 2) * ux, y = size.height / 2 + u * uy + v * vy - (tw / 2) * uy;
            if (x < -tw || x > size.width + tw || y < -tw || y > size.height + tw) continue;
            target.drawText(word, { x: x + fs * 0.04, y: y - fs * 0.04, size: fs, font: mark, color: rgb(0, 0, 0), opacity: 0.045, rotate: degrees(30) });
            target.drawText(word, { x, y, size: fs, font: mark, color: rgb(1, 1, 1), opacity: 0.2, rotate: degrees(30) });
          }
      }
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
/** Feature A: page 1 of the public preview as a WebP cover (480 px wide, 360 px if that is over 280 KB). */
export async function renderProductCover(previewBlob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await previewBlob.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const size = page.getViewport({ scale: 1 });
    for (const width of [480, 360]) {
      const viewport = page.getViewport({ scale: width / size.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.min(1800, Math.round(viewport.height));
      try {
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport, background: "white" }).promise;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
        // Browsers without WebP encoding hand back PNG: never store that as a cover.
        if (!blob || blob.type !== "image/webp") throw new Error("This browser cannot make a WebP cover.");
        if (blob.size <= 280 * 1024 || width === 360) {
          if (blob.size > 307200) throw new Error("Cover too large.");
          return { blob, width: canvas.width, height: canvas.height };
        }
      } finally {
        canvas.width = canvas.height = 1;
      }
    }
    throw new Error("Cover too large.");
  } finally {
    await doc.destroy();
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
