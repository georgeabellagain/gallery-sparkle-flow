import test from "node:test";
import assert from "node:assert/strict";
import { beginPortfolioDraft, discardPortfolioDraft, savePortfolioDraft, portfolioDraftDirty, getDoc, getSavedDoc, patchPortfolio, patchPortfolioAppearance, replaceDoc, setCommitHook, switchPortfolio, DEFAULT_VIEWER, type Doc } from "../src/lib/portfolia/store";
import { premiumAppearance, freeViewer } from "../src/lib/portfolia/premium-appearance";
import { deleteBlob } from "../src/lib/portfolia/assets";
import { bookPurchaseUrl } from "../src/lib/portfolia/book-marketing";
const cache = new Map<string,string>();
let fail = false;
Object.assign(globalThis, { window: {}, localStorage: { getItem: (key:string) => cache.get(key), setItem: (key:string,value:string) => { if(fail) throw Error("quota"); cache.set(key,value); } } });
const fixture = (): Doc => ({ v: 1, account: { signedIn: true }, portfolio: { code: "drafttest", status: "published", name: "Saved book", profile: { name: "Author", title: "", intro: "", email: "", links: [] }, plan: "free", pdf: { blobKey: "pdf_saved", bytes: 10, name: "book.pdf", pages: 2, uploadedAt: 1 }, allowDownload: true, viewer: { ...DEFAULT_VIEWER, studioLighting: "4" }, createdAt: 1 }, others: [], analytics: { visits: [], downloads: [] } });
test("editor previews never persist or invoke cloud sync; discard restores the exact saved book", async () => {
  replaceDoc(fixture()); let commits = 0; setCommitHook(() => commits++);
  const saved = JSON.stringify(getSavedDoc());
  beginPortfolioDraft("drafttest");
  patchPortfolio({ name: "Preview only" }); patchPortfolioAppearance("drafttest", { viewer: { studioLighting: "15", backgroundPreset: "marble_tiles" } });
  assert.equal(getDoc().portfolio?.name, "Preview only"); assert.equal(portfolioDraftDirty(), true);
  assert.equal(commits, 0); assert.equal(JSON.stringify(getSavedDoc()), saved); assert.equal(cache.get("portfolia.simple.v1"), saved);
  await deleteBlob("pdf_saved"); // Draft edits cannot delete a file used by the saved version.
  discardPortfolioDraft(); assert.equal(JSON.stringify(getDoc()), saved); assert.equal(portfolioDraftDirty(), false);
  beginPortfolioDraft("drafttest"); patchPortfolio({ name: "New saved book" });
  assert.equal(savePortfolioDraft(), true); assert.equal(commits, 1); assert.equal(portfolioDraftDirty(), false);
  discardPortfolioDraft(); assert.equal(getDoc().portfolio?.name, "New saved book"); setCommitHook(null);
});
test("failed explicit saves preserve both the previous version and the editable draft", () => {
  replaceDoc(fixture()); beginPortfolioDraft("drafttest"); patchPortfolio({ name: "Unsaved" });
  fail = true; assert.equal(savePortfolioDraft(), false); fail = false;
  assert.equal(getSavedDoc().portfolio?.name, "Saved book"); assert.equal(getDoc().portfolio?.name, "Unsaved"); assert.equal(portfolioDraftDirty(), true); discardPortfolioDraft();
});
test("background and HDRI entitlement checks include every viewing context", () => {
  const p = fixture().portfolio!;
  assert.deepEqual(premiumAppearance(p), []);
  const premium = { ...p, viewer: { ...p.viewer!, studioLighting: "9" as const, backgrounds: { paged: { backgroundPreset: "denim_fabric_03" }, studio: { backgroundKey: "private_bg" } } } };
  assert.deepEqual(premiumAppearance(premium), ["Personal HDRI lighting", "Personal backgrounds"]);
  const free = freeViewer(premium.viewer)!; assert.equal(free.studioLighting, "4"); assert.equal(free.backgrounds?.paged?.backgroundPreset, undefined); assert.equal(free.backgrounds?.studio?.backgroundKey, undefined);
  assert.equal(freeViewer({ ...p.viewer!, backgroundPreset: "wood_floor" })?.backgroundPreset, "wood_floor");
});
test("purchase links accept ordinary shop URLs and reject executable or credential-bearing links", () => {
  assert.equal(bookPurchaseUrl("https://amazon.co.uk/dp/example"), "https://amazon.co.uk/dp/example");
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "https://user:pass@example.com", "not a URL"]) assert.equal(bookPurchaseUrl(url), undefined);
});

test("switching portfolios cannot park unsaved previews in the saved list", () => {
  const doc = fixture(); doc.others = [{ portfolio: { ...structuredClone(doc.portfolio!), code: "second" }, analytics: { visits: [], downloads: [] } }];
  replaceDoc(doc); beginPortfolioDraft("drafttest"); patchPortfolio({ name: "Never persist this" });
  switchPortfolio("second");
  assert.equal(getSavedDoc().others.find(item => item.portfolio.code === "drafttest")?.portfolio.name, "Saved book");
});
