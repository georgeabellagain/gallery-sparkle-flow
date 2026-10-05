import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFDict, PDFString, StandardFonts } from "pdf-lib";
import { compressPdfBytes } from "../src/lib/portfolia/compress";

test("optimisation shrinks an uncompressed PDF while retaining pages, text streams and links", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 20; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Portfolio page ${i + 1}`, { x: 20, y: 550, font, size: 18 });
    const annotation = doc.context.register(doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [20, 500, 200, 540], A: { Type: "Action", S: "URI", URI: PDFString.of('https://example.com/work') } }));
    page.node.set(PDFName.of("Annots"), doc.context.obj([annotation]));
  }
  const original = await doc.save({ useObjectStreams: false });
  const snapshot = original.slice();
  const result = await compressPdfBytes(original);
  assert.ok(result.byteLength < original.byteLength);
  assert.deepEqual(original, snapshot);
  const before = await PDFDocument.load(original);
  const after = await PDFDocument.load(result);
  assert.equal(after.getPageCount(), 20);
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(after.getPage(i).getSize(), before.getPage(i).getSize());
    const annotations = after.getPage(i).node.lookup(PDFName.of('Annots'), PDFArray);
    assert.equal(annotations.size(), 1);
    const oldStream = before.getPage(i).node.Contents();
    const newStream = after.getPage(i).node.Contents();
    const oldArray = oldStream as PDFArray;
    const newArray = newStream as PDFArray;
    assert.deepEqual(after.context.lookup(newArray.get(0), PDFRawStream).getContents(), before.context.lookup(oldArray.get(0), PDFRawStream).getContents());
    const action = after.context.lookup(annotations.get(0), PDFDict).lookup(PDFName.of('A'), PDFDict);
    assert.equal(action.lookup(PDFName.of('URI'), PDFString).decodeText(), 'https://example.com/work');
  }
});

test("already compact input is never replaced with a larger file", async () => {
  const doc = await PDFDocument.create(); doc.addPage();
  const first = await compressPdfBytes(await doc.save());
  const second = await compressPdfBytes(first);
  assert.ok(second.byteLength <= first.byteLength);
});

test("signed PDFs are rejected instead of invalidating their signature", async () => {
  const doc = await PDFDocument.create(); doc.addPage();
  doc.context.register(doc.context.obj({ Type: "Sig", ByteRange: [0, 100, 200, 300] }));
  await assert.rejects(compressPdfBytes(await doc.save()), /Signed PDFs/);
});
