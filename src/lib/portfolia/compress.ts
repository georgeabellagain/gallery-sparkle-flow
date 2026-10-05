import { PDFDict, PDFDocument, PDFName } from "pdf-lib";

/** Repack PDF objects without rasterising pages or downsampling artwork. */
export async function compressPdfBytes(input: Uint8Array): Promise<Uint8Array> {
  if (input.byteLength > 75 * 1024 * 1024) throw new Error("For PDFs above 75 MB, export a smaller web copy from your design app first.");
  const doc = await PDFDocument.load(input, { updateMetadata: false });
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && (object.has(PDFName.of("ByteRange")) || object.get(PDFName.of("FT")) === PDFName.of("Sig"))) {
      throw new Error("Signed PDFs cannot be optimised here. Use the original or export an unsigned portfolio copy.");
    }
  }
  const output = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: 30 });
  return output.byteLength < input.byteLength ? output : input;
}
