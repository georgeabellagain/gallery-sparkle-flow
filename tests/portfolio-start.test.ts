import assert from "node:assert/strict";
import test from "node:test";
import { getDoc, replaceDoc, startPortfolio, switchPortfolio, beginNewPortfolio, patchPortfolioAppearance, portfolioUsesAsset, DEFAULT_VIEWER, type Doc, type PdfFile } from "../src/lib/portfolia/store";

const storage = new Map<string, string>();
let blocked = false;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { if (blocked) throw new Error("Storage blocked"); storage.set(key, value); },
} });
const empty = (): Doc => ({ v: 1, account: { signedIn: false }, portfolio: null, analytics: { visits: [], downloads: [] }, others: [] });
const pdf: PdfFile = { blobKey: "test-pdf", name: "portfolio.pdf", bytes: 1000, pages: 3, uploadedAt: 1 };

test("first upload opens as a flipbook draft without publishing or requiring sign-in", () => {
  replaceDoc(empty());
  assert.equal(startPortfolio(pdf), true);
  const doc = getDoc();
  assert.equal(doc.portfolio?.viewer?.mode, "book");
  assert.equal(doc.portfolio?.status, "draft");
  assert.equal(doc.account.signedIn, false);
  assert.equal(DEFAULT_VIEWER.mode, "scroll", "older portfolios keep the existing default");
});

test("new portfolios retain independent backgrounds, including a delayed save after switching", () => {
  replaceDoc(empty()); startPortfolio(pdf);
  const doc = structuredClone(getDoc());
  doc.portfolio!.plan = "personal";
  doc.portfolio!.viewer = { ...DEFAULT_VIEWER, backgroundColor: "#112233", backgroundKey: "first-background" };
  replaceDoc(doc);
  const first = structuredClone(getDoc().portfolio!);
  assert.equal(beginNewPortfolio(), true);
  assert.equal(startPortfolio({ ...pdf, blobKey: "second-pdf" }), true);
  const secondCode = getDoc().portfolio!.code;
  assert.equal(getDoc().portfolio?.viewer?.backgroundKey, undefined);
  switchPortfolio(first.code);
  assert.equal(patchPortfolioAppearance(secondCode, { viewer: { backgroundKey: "second-background", backgroundColor: "#abcdef" } }), true);
  assert.deepEqual(getDoc().portfolio, first, "delayed second-PDF upload cannot change the active first PDF");
  switchPortfolio(secondCode);
  assert.equal(getDoc().portfolio?.viewer?.backgroundKey, "second-background");
  assert.equal(getDoc().portfolio?.pdf?.blobKey, "second-pdf");
});

test("appearance patches merge current fields and never save a deleted editor into another portfolio", () => {
  replaceDoc(empty()); startPortfolio(pdf);
  const code = getDoc().portfolio!.code;
  patchPortfolioAppearance(code, { viewer: { backgroundColor: "#112233" } });
  patchPortfolioAppearance(code, { viewer: { studioLighting: "8" } });
  assert.equal(getDoc().portfolio?.viewer?.backgroundColor, "#112233");
  const before = structuredClone(getDoc());
  assert.equal(patchPortfolioAppearance("removed-code", { viewer: { backgroundColor: "#ff0000" } }), false);
  assert.deepEqual(getDoc(), before);
  blocked = true;
  try {
    assert.equal(patchPortfolioAppearance(code, { viewer: { backgroundKey: "failed-save" } }), false);
    assert.deepEqual(getDoc(), before);
  } finally { blocked = false; }
});

test("background files shared by older portfolios remain referenced after one replaces or removes its image", () => {
  replaceDoc(empty()); startPortfolio(pdf);
  const doc = structuredClone(getDoc());
  doc.portfolio!.viewer = { ...DEFAULT_VIEWER, backgroundKey: "shared-background" };
  doc.others = [{ portfolio: { ...structuredClone(doc.portfolio!), code: "other" }, analytics: { visits: [], downloads: [] } }];
  replaceDoc(doc);
  patchPortfolioAppearance(doc.portfolio!.code, { viewer: { backgroundKey: "replacement" } });
  assert.equal(portfolioUsesAsset("shared-background"), true);
  patchPortfolioAppearance("other", { viewer: { backgroundKey: undefined } });
  assert.equal(portfolioUsesAsset("shared-background"), false);
  assert.equal(portfolioUsesAsset("replacement"), true);
});

test("replacing an existing draft preserves its chosen reader and identity", () => {
  replaceDoc(empty());
  startPortfolio(pdf);
  const doc = structuredClone(getDoc());
  doc.portfolio!.viewer = { ...DEFAULT_VIEWER, mode: "paged" };
  doc.portfolio!.profile.name = "Example designer";
  replaceDoc(doc);
  startPortfolio({ ...pdf, blobKey: "replacement" });
  assert.equal(getDoc().portfolio?.viewer?.mode, "paged");
  assert.equal(getDoc().portfolio?.code, doc.portfolio?.code);
  assert.equal(getDoc().portfolio?.profile.name, "Example designer");
  assert.equal(getDoc().portfolio?.pdf?.blobKey, "replacement");
});

test("a homepage upload cannot replace a published portfolio", () => {
  const doc = structuredClone(getDoc());
  doc.portfolio!.status = "published";
  replaceDoc(doc);
  startPortfolio({ ...pdf, blobKey: "must-not-replace" });
  assert.deepEqual(getDoc(), doc);
});


test("Edit on another owned portfolio selects it and preserves the previous portfolio", () => {
  replaceDoc(empty());
  startPortfolio(pdf);
  const doc = structuredClone(getDoc());
  const first = structuredClone(doc.portfolio!);
  const other = { ...structuredClone(first), code: "second-portfolio" };
  doc.others = [{ portfolio: other, analytics: { visits: [{ t: 1, v: "visitor" }], downloads: [] } }];
  replaceDoc(doc);
  assert.equal(switchPortfolio(other.code), true);
  assert.equal(getDoc().portfolio?.code, other.code);
  assert.deepEqual(getDoc().others[0]?.portfolio, first);
  assert.equal(getDoc().analytics.visits.length, 1);
  assert.equal(switchPortfolio(other.code), true);
  assert.equal(getDoc().others.length, 1, "reopening the active editor does not duplicate portfolios");
});
