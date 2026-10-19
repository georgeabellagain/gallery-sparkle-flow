import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, type PDFObject } from "pdf-lib";

/** Re-encodes one JPEG at the target size; returns null when it cannot. Runs in a worker in the browser. */
export type Reencode = (jpeg: Uint8Array, target: { width: number; height: number }) => Promise<Uint8Array | null>;

/** Longest side for photos: about 200 dpi across an A4 page, sharp on screens and phones. */
export const WEB_MAX_SIDE = 2400;

const name = (o: PDFObject | undefined) => (o instanceof PDFName ? o.decodeText() : undefined);

/** Only plain 8-bit RGB JPEGs: CMYK, greyscale, masks and custom decodes are left exactly as they are. */
function isRgbJpeg(doc: PDFDocument, dict: PDFDict): boolean {
  let filter = dict.lookup(PDFName.of("Filter"));
  if (filter instanceof PDFArray) filter = filter.size() === 1 ? filter.lookup(0) : undefined;
  if (name(filter) !== "DCTDecode" || dict.has(PDFName.of("Decode")) || dict.has(PDFName.of("ImageMask"))) return false;
  const bits = dict.lookup(PDFName.of("BitsPerComponent"));
  if (bits instanceof PDFNumber && bits.asNumber() !== 8) return false;
  const space = dict.lookup(PDFName.of("ColorSpace"));
  if (name(space) === "DeviceRGB") return true;
  if (space instanceof PDFArray && name(space.lookup(0)) === "ICCBased") {
    const profile = doc.context.lookup(space.get(1));
    const n = profile instanceof PDFRawStream ? profile.dict.lookup(PDFName.of("N")) : undefined;
    return n instanceof PDFNumber && n.asNumber() === 3;
  }
  return false;
}

/**
 * Makes a smaller web copy: large photos are resized to WEB_MAX_SIDE and re-saved as JPEG. Text, vector
 * artwork, links and page sizes are untouched. The input bytes are never modified.
 */
export async function webCopyPdfBytes(input: Uint8Array, reencode: Reencode, maxSide = WEB_MAX_SIDE): Promise<{ bytes: Uint8Array; images: number }> {
  if (input.byteLength > 150 * 1024 * 1024) throw new Error("For PDFs above 150 MB, export a smaller web copy from your design app first.");
  const doc = await PDFDocument.load(input.slice(), { updateMetadata: false });
  let images = 0;
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && (object.has(PDFName.of("ByteRange")) || name(object.get(PDFName.of("FT"))) === "Sig"))
      throw new Error("Signed PDFs cannot be changed here. Use an unsigned copy of your portfolio.");
    if (!(object instanceof PDFRawStream) || name(object.dict.lookup(PDFName.of("Subtype"))) !== "Image" || !isRgbJpeg(doc, object.dict)) continue;
    const w = object.dict.lookup(PDFName.of("Width")), h = object.dict.lookup(PDFName.of("Height"));
    if (!(w instanceof PDFNumber) || !(h instanceof PDFNumber)) continue;
    const width = w.asNumber(), height = h.asNumber(), contents = object.getContents();
    const scale = Math.min(1, maxSide / Math.max(width, height));
    // Small images and already light JPEGs are left alone.
    if (scale === 1 && contents.byteLength < width * height * 0.35) continue;
    const target = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    const out = await reencode(contents, target).catch(() => null);
    if (!out || out.byteLength >= contents.byteLength * 0.9) continue;
    const dict = object.dict.clone(doc.context);
    dict.set(PDFName.of("Width"), PDFNumber.of(target.width));
    dict.set(PDFName.of("Height"), PDFNumber.of(target.height));
    dict.delete(PDFName.of("DecodeParms"));
    doc.context.assign(ref, PDFRawStream.of(dict, out));
    images++;
  }
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: 30 });
  return bytes.byteLength < input.byteLength ? { bytes, images } : { bytes: input, images: 0 };
}

/** Browser re-encoder: decodes without colour conversion so embedded ICC profiles still describe the pixels. */
export const browserReencode: Reencode = async (jpeg, target) => {
  if (typeof createImageBitmap === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), { colorSpaceConversion: "none", resizeWidth: target.width, resizeHeight: target.height, resizeQuality: "high" });
  try {
    const canvas = new OffscreenCanvas(target.width, target.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
    return new Uint8Array(await blob.arrayBuffer());
  } finally { bitmap.close(); }
};
