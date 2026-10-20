import test from "node:test";
import assert from "node:assert/strict";
import { attachPageImages, beginPortfolioDraft, discardPortfolioDraft, getDoc, getSavedDoc, patchPortfolio, portfolioDraftDirty, portfolioUsesAsset, replaceDoc, setCommitHook, DEFAULT_VIEWER, type Doc } from "../src/lib/portfolia/store";
import type { PageImages } from "../src/lib/portfolia/page-images";

const cache = new Map<string, string>();
Object.assign(globalThis, { window: {}, localStorage: { getItem: (key: string) => cache.get(key), setItem: (key: string, value: string) => void cache.set(key, value) } });
const fixture = (): Doc => ({ v: 1, account: { signedIn: true }, portfolio: { code: "pictures", status: "published", profile: { name: "Author", title: "", intro: "", email: "", links: [] }, plan: "free", pdf: { blobKey: "pdf_saved", bytes: 10, name: "book.pdf", pages: 1, uploadedAt: 1 }, allowDownload: true, viewer: DEFAULT_VIEWER, createdAt: 1, synced: true }, others: [], analytics: { visits: [], downloads: [] } });
const manifest: PageImages = { v: 1, pdfKey: "pdf_saved", format: "jpg", sizes: [1600, 2560], pages: [{ w: 595, h: 842, px: [[1131, 1600], [1809, 2560]] }], createdAt: 2 };

test("finished pictures reach the saved portfolio and an open draft without making the draft look edited", () => {
  replaceDoc(fixture());
  let commits = 0; setCommitHook(() => commits++);
  beginPortfolioDraft("pictures");
  assert.equal(attachPageImages("pictures", "pdf_saved", manifest), true);
  assert.equal(commits, 1, "the account is synced with the new manifest");
  assert.equal(getSavedDoc().portfolio?.pdf?.pageImages?.createdAt, 2);
  assert.equal(getDoc().portfolio?.pdf?.pageImages?.createdAt, 2);
  assert.equal(portfolioDraftDirty(), false);
  patchPortfolio({ name: "Preview" });
  assert.equal(portfolioDraftDirty(), true);
  discardPortfolioDraft();
  assert.equal(getDoc().portfolio?.pdf?.pageImages?.createdAt, 2);
  assert.ok(portfolioUsesAsset("pdf_saved_pages/1-2560.jpg"), "retention keeps pictures the saved portfolio uses");
  setCommitHook(null);
});

test("pictures are never attached to a different PDF or a signed-out browser", () => {
  replaceDoc(fixture());
  assert.equal(attachPageImages("pictures", "pdf_other", { ...manifest, pdfKey: "pdf_other" }), false);
  replaceDoc({ ...fixture(), account: { signedIn: false } });
  assert.equal(attachPageImages("pictures", "pdf_saved", manifest), false);
  assert.equal(getSavedDoc().portfolio?.pdf?.pageImages, undefined);
});
