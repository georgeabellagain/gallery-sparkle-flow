import assert from "node:assert/strict";
import test from "node:test";
import { getDoc, replaceDoc, startPortfolio, switchPortfolio, DEFAULT_VIEWER, type Doc, type PdfFile } from "../src/lib/portfolia/store";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
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
