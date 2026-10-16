import assert from "node:assert/strict";
import test from "node:test";
import { getDoc, replaceDoc, startPortfolio, switchPortfolio, beginNewPortfolio, patchPortfolioAppearance, patchPortfolioExtra, patchPortfolio, allPortfolios, portfolioUsesAsset, DEFAULT_VIEWER, type Doc, type PdfFile } from "../src/lib/portfolia/store";

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

test("a new homepage upload creates an independent editor and preserves the prior portfolio",()=>{
  replaceDoc(empty());startPortfolio(pdf);
  const before=structuredClone(getDoc());before.portfolio!.plan="personal";before.portfolio!.status="published";
  before.portfolio!.name="Existing work";before.portfolio!.profile.name="Designer";
  before.analytics.visits=[{t:1,v:"existing-visitor"}];replaceDoc(before);
  assert.equal(startPortfolio({...pdf,blobKey:"new-home-upload"},{newPortfolio:true}),true);
  const after=getDoc();
  assert.notEqual(after.portfolio!.code,before.portfolio!.code);
  assert.equal(after.portfolio!.pdf!.blobKey,"new-home-upload");
  assert.equal(after.portfolio!.status,"draft");
  assert.equal(after.portfolio!.profile.name,"Designer");
  assert.deepEqual(after.others[0]!.portfolio,before.portfolio);
  assert.deepEqual(after.others[0]!.analytics,before.analytics);
  assert.deepEqual(after.analytics,{visits:[],downloads:[]});
});

test("new homepage uploads cannot overwrite free portfolios or partially save a failed upload",()=>{
  replaceDoc(empty());startPortfolio(pdf);const free=structuredClone(getDoc());
  assert.equal(startPortfolio({...pdf,blobKey:"blocked"},{newPortfolio:true}),false);
  assert.deepEqual(getDoc(),free);
  const paid=structuredClone(free);paid.portfolio!.plan="personal";replaceDoc(paid);
  blocked=true;
  try {
    assert.equal(startPortfolio({...pdf,blobKey:"failed"},{newPortfolio:true}),false);
    assert.deepEqual(getDoc(),paid,"archiving and creating commit together or leave the old editor untouched");
  } finally {blocked=false;}
});


test("live scrapbook saves stay with their original portfolio and PDF",()=>{
  replaceDoc(empty());startPortfolio(pdf);
  const note={id:"live-note",page:1,half:"right" as const,title:"Note",colour:"#ffffff",hinge:"top" as const,x:.2,y:.2,width:.3,height:.3};
  patchPortfolio({pdf:{...pdf,foldouts:[note]}});
  const firstCode=getDoc().portfolio!.code;
  const d=structuredClone(getDoc());d.portfolio!.plan="personal";replaceDoc(d);
  beginNewPortfolio();startPortfolio({...pdf,blobKey:"other-pdf"});
  const second=structuredClone(getDoc().portfolio!);
  assert.equal(patchPortfolioExtra(firstCode,pdf.blobKey,"foldouts",note.id,{...note,x:.4}),true);
  assert.deepEqual(getDoc().portfolio,second,"a delayed drag cannot edit the portfolio opened next");
  assert.equal(allPortfolios(getDoc()).find(p=>p.code===firstCode)!.pdf!.foldouts![0]!.x,.4);
  assert.equal(patchPortfolioExtra(firstCode,"replaced-pdf","foldouts",note.id,{...note,x:.5}),false);
  assert.equal(patchPortfolioExtra(firstCode,pdf.blobKey,"foldouts",note.id,{...note,id:"wrong"}),false);
});
test("per-view pictures remain referenced assets even when not the main background",()=>{
  replaceDoc(empty());startPortfolio(pdf);
  patchPortfolioAppearance(getDoc().portfolio!.code,{viewer:{backgrounds:{studio:{backgroundKey:"view-only-image"}},backgroundUploads:["saved-upload"]}});
  assert.equal(portfolioUsesAsset("view-only-image"),true);assert.equal(portfolioUsesAsset("saved-upload"),true);
});
