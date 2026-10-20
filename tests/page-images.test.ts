import test from "node:test";
import assert from "node:assert/strict";
import { currentPageImageKeys, pageImageDensity, pageImageKeys, pageImagePixels, pickPageImage, readablePageImages, safeAssetKey, type PageImages } from "../src/lib/portfolia/page-images";
import { publicAssetKeys } from "../src/lib/portfolia/public-assets";
import { servePortfolioFile } from "../src/lib/portfolia/file.server";
import { accountExport } from "../src/lib/portfolia/data-export";
import { artworkVersion, createPageImageDocument, isPageImageDocument, presetDensity, whenFullPdf } from "../src/lib/portfolia/page-image-doc";
import { detectDensity } from "../src/lib/portfolia/resolution";
import { isStreamedPdf, markStreamedPdf } from "../src/lib/portfolia/remote-pdf";
import type { Doc, Portfolio } from "../src/lib/portfolia/store";

const manifest = (extra: Partial<PageImages> = {}): PageImages => ({
  v: 1, pdfKey: "pdf_abc", format: "webp", sizes: [1600, 2560], createdAt: 1,
  pages: [
    { w: 595, h: 842, px: [[1131, 1600], [1809, 2560]], links: [{ url: "https://example.com/work", x: 0.1, y: 0.2, w: 0.3, h: 0.05 }] },
    { w: 595, h: 842, px: [[1131, 1600], [1809, 2560]] },
  ],
  ...extra,
});
const pdf = (pageImages: unknown = manifest()) => ({ blobKey: "pdf_abc", pages: 2, pageImages });

test("page picture sizes follow the long side, give each half of a spread that detail and never pass 4096", () => {
  assert.deepEqual(pageImagePixels(595, 842, 1600), [1131, 1600]);
  assert.deepEqual(pageImagePixels(1190, 842, 1600), [2261, 1600]);
  assert.deepEqual(pageImagePixels(1190, 842, 2560), [3618, 2560]);
  assert.deepEqual(pageImagePixels(1684, 842, 2560), [4096, 2048]);
  // A landscape page may be a spread shown as two leaves, so each half keeps the size.
  assert.deepEqual(pageImagePixels(842, 595, 1600), [2264, 1600]);
});

test("a manifest is only used for the exact PDF it was drawn from, and only when well formed", () => {
  assert.ok(readablePageImages(pdf()));
  assert.equal(readablePageImages({ ...pdf(), blobKey: "pdf_new" }), null);
  assert.equal(readablePageImages({ ...pdf(), pages: 3 }), null);
  assert.equal(readablePageImages(pdf(manifest({ format: "png" as never }))), null);
  assert.equal(readablePageImages(pdf(manifest({ sizes: [1600, 1600] as never }))), null);
  assert.equal(readablePageImages(pdf(manifest({ sizes: [999] as never }))), null);
  const script = manifest();
  script.pages[0]!.links = [{ url: "javascript:alert(1)", x: 0, y: 0, w: 1, h: 1 }];
  assert.equal(readablePageImages(pdf(script)), null);
  const huge = manifest();
  huge.pages[1]!.px = [[1131, 1600], [9000, 2560]];
  assert.equal(readablePageImages(pdf(huge)), null);
});

test("picture keys live in the PDF's folder; stale manifests still name their files for clean-up but are never signed", () => {
  assert.deepEqual(pageImageKeys(pdf()), ["pdf_abc_pages/1-1600.webp", "pdf_abc_pages/1-2560.webp", "pdf_abc_pages/2-1600.webp", "pdf_abc_pages/2-2560.webp"]);
  assert.equal(currentPageImageKeys(pdf()).length, 4);
  assert.equal(pageImageKeys({ ...pdf(), blobKey: "pdf_new" }).length, 4);
  assert.deepEqual(currentPageImageKeys({ ...pdf(), blobKey: "pdf_new" }), []);
  assert.deepEqual(pageImageKeys({ pageImages: { ...manifest(), pdfKey: "../other" } }), []);
  assert.ok(safeAssetKey("pdf_abc_pages/12-2560.jpg"));
  for (const key of ["pdf_abc_pages/../x", "pdf_abc/1-1600.webp", "pdf_abc_pages/1-1600.svg", "pdf_abc_pages/0-1600.webp", "a/b", "../pdf_abc"]) assert.equal(safeAssetKey(key), false, key);
});

test("visitors get the current PDF's pictures on every plan", () => {
  const p = { code: "book", plan: "free", profile: {}, pdf: { ...pdf(), name: "a.pdf", bytes: 1, uploadedAt: 1 } } as unknown as Portfolio;
  const keys = publicAssetKeys(p, false);
  assert.ok(keys.includes("pdf_abc") && keys.includes("pdf_abc_pages/2-2560.webp"));
  const replaced = { ...p, pdf: { ...p.pdf!, blobKey: "pdf_new" } };
  assert.ok(!publicAssetKeys(replaced, true).some((k) => k.includes("_pages/")));
});

test("the protected file route serves a referenced page picture and refuses others", async () => {
  let downloaded = "";
  const row = { owner_id: "owner", data: { plan: "free", pdf: pdf(), profile: {} } };
  const db = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }) }), storage: { from: () => ({ download: async (path: string) => { downloaded = path; return { data: new Blob(["img"], { type: "image/webp" }), error: null }; } }) } };
  const open = async () => ({ policy: null, state: "open" as const });
  const url = (key: string) => `https://portfolia.site/api/public/portfolio-file/book?asset=${encodeURIComponent(key)}`;
  const ok = await servePortfolioFile("book", url("pdf_abc_pages/2-1600.webp"), db, open);
  assert.equal(ok.status, 200); assert.equal(downloaded, "owner/pdf_abc_pages/2-1600.webp"); assert.equal(ok.headers.get("content-type"), "image/webp");
  assert.equal((await servePortfolioFile("book", url("pdf_abc_pages/3-1600.webp"), db, open)).status, 404);
  assert.equal((await servePortfolioFile("book", url("pdf_other_pages/1-1600.webp"), db, open)).status, 404);
});

test("the smallest picture that covers the screen is chosen, else the largest", () => {
  const page = manifest().pages[0]!;
  assert.equal(pickPageImage(page, 900), 0);
  assert.equal(pickPageImage(page, 1700), 0);
  assert.equal(pickPageImage(page, 1900), 1);
  assert.equal(pickPageImage(page, 5000), 1);
  assert.ok(Math.abs(pageImageDensity(manifest()) - 1809 / 595) < 1e-9);
});

test("the data export lists every stored page picture", () => {
  const p = { code: "a1", profile: {}, pdf: pdf() } as unknown as Portfolio;
  const doc = { v: 1, account: { signedIn: true }, portfolio: p, analytics: { visits: [], downloads: [] }, others: [] } as Doc;
  assert.equal(accountExport(doc).portfolios[0]!.pagePictureFiles?.length, 4);
});

test("the picture document draws pictures, carries the PDF's links and never opens the PDF to show a page", async () => {
  const fetched: string[] = [];
  let refreshed = 0, opened = 0, expired = true;
  const fetcher = (async (url: string) => {
    fetched.push(url);
    if (url.includes("2-1600") && expired) { expired = false; return new Response(null, { status: 400 }); }
    return new Response(new Blob(["x"], { type: "image/webp" }));
  }) as unknown as typeof fetch;
  const drawn: number[][] = [];
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () => ({ close() {} });
  const doc = createPageImageDocument(
    { manifest: manifest(), url: (k) => `https://cdn/${k}?t=${refreshed}`, refresh: async () => { refreshed++; } },
    async () => { opened++; throw new Error("not in this test"); },
    { fetcher },
  );
  markStreamedPdf(doc);
  assert.ok(isPageImageDocument(doc) && isStreamedPdf(doc));
  assert.equal(doc.numPages, 2);
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  assert.equal(viewport.width, 1190);
  const ctx = { canvas: { width: 1190, height: 1684 }, save() {}, restore() {}, setTransform() {}, fillRect() {}, drawImage: (...args: unknown[]) => drawn.push(args.slice(1).map(Number)) } as unknown as CanvasRenderingContext2D;
  await page.render({ canvasContext: ctx, viewport }).promise;
  assert.deepEqual(drawn[0], [0, 0, 1190, 1684]);
  assert.match(fetched[0]!, /pdf_abc_pages\/1-1600\.webp/);
  const [link] = await page.getAnnotations();
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(link!.rect);
  assert.equal(link!.url, "https://example.com/work");
  assert.ok(Math.abs(Math.min(x1!, x2!) - 119) < 1e-6 && Math.abs(Math.min(y1!, y2!) - 336.8) < 1e-6);
  // An expired link is re-signed and retried.
  await (await doc.getPage(2)).render({ canvasContext: ctx, viewport: (await doc.getPage(2)).getViewport({ scale: 1 }) }).promise;
  assert.equal(refreshed, 1);
  assert.equal(opened, 0);
  assert.ok(Math.abs((await detectDensity(doc as never, {} as never)) - presetDensity(doc)!) < 1e-9);
  await doc.destroy();
});

test("a page whose picture is missing is drawn from the PDF instead", async () => {
  const fetcher = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
  let pdfRenders = 0;
  const real = { getPage: async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale, scale }), render: () => { pdfRenders++; return { promise: Promise.resolve(), cancel() {} }; } }), destroy: async () => {} };
  const doc = createPageImageDocument({ manifest: manifest(), url: (k) => `https://cdn/${k}`, refresh: async () => {} }, async () => real as never, { fetcher });
  const page = await doc.getPage(2);
  const ctx = { canvas: { width: 595, height: 842 } } as unknown as CanvasRenderingContext2D;
  const started = Date.now();
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: 1 }) }).promise;
  assert.equal(pdfRenders, 1);
  assert.ok(Date.now() - started < 10000);
  await doc.destroy();
});

test("zooming in beyond the pictures draws from the PDF once it is open, never waiting for it", async () => {
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () => ({ close() {} });
  const fetcher = (async () => new Response(new Blob(["x"]))) as unknown as typeof fetch;
  let pdfRenders = 0;
  const real = { getPage: async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale, scale }), render: () => { pdfRenders++; return { promise: Promise.resolve(), cancel() {} }; } }), destroy: async () => {} };
  const doc = createPageImageDocument({ manifest: manifest(), url: (k) => `https://cdn/${k}`, refresh: async () => {} }, async () => real as never, { fetcher });
  const page = await doc.getPage(1);
  const deep = page.getViewport({ scale: 6 });
  const ctx = { canvas: { width: 3570, height: 5052 }, save() {}, restore() {}, setTransform() {}, fillRect() {}, drawImage() {} } as unknown as CanvasRenderingContext2D;
  await page.render({ canvasContext: ctx, viewport: deep }).promise;
  assert.equal(pdfRenders, 0, "the picture is drawn while the PDF is still closed");
  assert.equal(artworkVersion(doc), 0);
  await new Promise<void>((resolve) => whenFullPdf(doc, resolve));
  assert.equal(artworkVersion(doc), 1);
  await page.render({ canvasContext: ctx, viewport: deep }).promise;
  assert.equal(pdfRenders, 1);
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: 2 }) }).promise;
  assert.equal(pdfRenders, 1, "normal sizes keep using the pictures");
  await doc.destroy();
});
