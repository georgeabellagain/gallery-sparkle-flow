import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, StandardFonts } from "pdf-lib";
import { webCopyPdfBytes, type Reencode } from "../src/lib/portfolia/web-copy";

/** Adds a fake JPEG XObject (bytes need not decode: the re-encoder is stubbed). */
function addJpeg(doc: PDFDocument, width: number, height: number, bytes: number, colorSpace = "DeviceRGB") {
  const stream = PDFRawStream.of(doc.context.obj({ Type: "XObject", Subtype: "Image", Width: width, Height: height, ColorSpace: colorSpace, BitsPerComponent: 8, Filter: "DCTDecode" }), new Uint8Array(bytes).fill(7));
  return doc.context.register(stream);
}
const stub: Reencode = async (_jpeg, t) => new Uint8Array(Math.round((t.width * t.height) / 50)).fill(1);

test("large RGB photos are resized for screens; text, pages and small or CMYK images are untouched", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText("Portfolio", { x: 40, y: 780, font, size: 24 });
  const big = addJpeg(doc, 6000, 4000, 4_000_000);
  const small = addJpeg(doc, 800, 600, 60_000);
  const cmyk = addJpeg(doc, 6000, 4000, 4_000_000, "DeviceCMYK");
  const original = await doc.save();
  const snapshot = original.slice();
  const { bytes, images } = await webCopyPdfBytes(original, stub);
  assert.deepEqual(original, snapshot, "input is never modified");
  assert.equal(images, 1);
  assert.ok(bytes.byteLength < original.byteLength * 0.7);
  const after = await PDFDocument.load(bytes);
  assert.equal(after.getPageCount(), 1);
  assert.deepEqual(after.getPage(0).getSize(), { width: 595, height: 842 });
  const dims = (ref: typeof big) => { const s = after.context.lookup(ref, PDFRawStream); return [s.dict.lookup(PDFName.of("Width"), PDFNumber).asNumber(), s.dict.lookup(PDFName.of("Height"), PDFNumber).asNumber()]; };
  assert.deepEqual(dims(big), [2400, 1600]);
  assert.deepEqual(dims(small), [800, 600]);
  assert.deepEqual(dims(cmyk), [6000, 4000]);
});

test("a PDF with nothing to resize comes back unchanged", async () => {
  const doc = await PDFDocument.create(); doc.addPage();
  const input = await doc.save();
  const { bytes, images } = await webCopyPdfBytes(input, stub);
  assert.equal(images, 0);
  assert.ok(bytes.byteLength <= input.byteLength);
});

test("signed PDFs are rejected", async () => {
  const doc = await PDFDocument.create(); doc.addPage();
  doc.context.register(doc.context.obj({ Type: "Sig", ByteRange: [0, 100, 200, 300] }));
  await assert.rejects(webCopyPdfBytes(await doc.save(), stub), /Signed PDFs/);
});
