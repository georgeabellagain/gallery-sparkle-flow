import assert from "node:assert/strict";
import test from "node:test";
import { projectFromHash, projectHash, projectPath, readableProjects, validateProjects } from "../src/lib/portfolia/projects";
import { getDoc, replaceDoc, replacePdf, startPortfolio, patchPortfolio, type Doc } from "../src/lib/portfolia/store";

const first = { id: "project_a", title: "Graduate collection", startPage: 2, endPage: 5 };
const second = { id: "project_b", title: "Textile study", startPage: 7, endPage: 10 };

test("project ranges allow ungrouped covers and gaps, and sort into PDF order", () => {
  assert.equal(validateProjects([second, first], 14), null);
  assert.deepEqual(readableProjects([second, first], 14), [first, second]);
  assert.equal(validateProjects([{ ...first, startPage: 14, endPage: 14 }], 14), null);
});

test("invalid, overlapping and duplicate ranges cannot be saved", () => {
  for (const patch of [{ title: " " }, { title: "x".repeat(81) }, { startPage: 0 }, { startPage: 2.5 }, { startPage: NaN }, { endPage: 15 }, { endPage: 1 }, { id: "#broken" }]) {
    assert.ok(validateProjects([{ ...first, ...patch }], 14));
  }
  assert.ok(validateProjects([first, { ...second, startPage: 5 }], 14));
  assert.ok(validateProjects([first, { ...second, id: first.id }], 14));
  assert.ok(validateProjects(Array.from({ length: 31 }, (_, i) => ({ id: `p${i}`, title: "Project", startPage: i + 1, endPage: i + 1 })), 40));
});

test("old portfolios and malformed cached metadata remain readable", () => {
  assert.deepEqual(readableProjects(undefined, 14), []);
  assert.deepEqual(readableProjects({ broken: true }, 14), []);
  assert.deepEqual(readableProjects([null, {}, first, { ...second, endPage: 80 }], 14), [first]);
  assert.deepEqual(readableProjects([first], 0), []);
});

test("project links survive renamed titles and changed page ranges, with safe unknown-link fallback", () => {
  const hash = projectHash(first.id);
  const edited = { ...first, title: "New name", startPage: 3 };
  assert.equal(projectFromHash(hash, [edited])?.startPage, 3);
  assert.equal(projectPath("abc23", first.id), "/p/abc23#project=project_a");
  for (const unknown of ["", "#upload", "#project=deleted", "#project=%", "#project=<script>"]) assert.equal(projectFromHash(unknown, [first]), undefined);
});

test("project metadata syncs with the PDF; replacing the PDF removes old ranges without changing the public identity", async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  } });
  const empty: Doc = { v: 1, account: { signedIn: false }, portfolio: null, analytics: { visits: [], downloads: [] }, others: [] };
  replaceDoc(empty);
  startPortfolio({ blobKey: "first", name: "first.pdf", bytes: 100, pages: 14, uploadedAt: 1 });
  const p = getDoc().portfolio!;
  patchPortfolio({ pdf: { ...p.pdf!, projects: [first, second] }, status: "published" });
  assert.deepEqual(getDoc().portfolio?.pdf?.projects, [first, second]);
  assert.ok([...storage.values()].some((json) => JSON.parse(json).portfolio.pdf.projects.length === 2));
  assert.equal(await replacePdf({ blobKey: "next", name: "next.pdf", bytes: 100, pages: 2, uploadedAt: 2 }), true);
  assert.equal(getDoc().portfolio?.pdf?.projects, undefined);
  assert.equal(getDoc().portfolio?.code, p.code);
  assert.equal(getDoc().portfolio?.status, "published");
});
