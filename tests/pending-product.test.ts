import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PENDING_KEY, PENDING_MAX_MB, PENDING_META_KEY, PENDING_TTL_MS, keepPendingProductPdf, pendingPdfProblem, takePendingProductPdf, type PendingDeps } from "../src/lib/products/pending";
import { SIGNIN_NEXT, signinDestination } from "../src/lib/portfolia/signin-target";

function memory(now = { t: 1_000_000 }) {
  const blobs = new Map<string, Blob>(), session = new Map<string, string>();
  const deps: PendingDeps = {
    put: async (k, b) => { blobs.set(k, b); },
    get: async (k) => blobs.get(k),
    remove: async (k) => { blobs.delete(k); },
    session: { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => { session.set(k, v); }, removeItem: (k) => { session.delete(k); } },
    now: () => now.t,
  };
  return { blobs, session, deps, now };
}
const pdf = (name = "book.pdf", size = 10) => new File([new Uint8Array(size)], name, { type: "application/pdf" });

test("non-PDFs and oversize files are refused at once", () => {
  assert.equal(pendingPdfProblem({ name: "book.pdf", size: 5, type: "application/pdf" }), null);
  assert.equal(pendingPdfProblem({ name: "BOOK.PDF", size: 5, type: "" }), null, "a missing type falls back to the extension");
  assert.match(pendingPdfProblem({ name: "photo.png", size: 5, type: "image/png" })!, /choose a PDF/i);
  assert.match(pendingPdfProblem({ name: "big.pdf", size: PENDING_MAX_MB * 1048576 + 1, type: "application/pdf" })!, /250 MB/);
  assert.equal(pendingPdfProblem({ name: "edge.pdf", size: PENDING_MAX_MB * 1048576, type: "application/pdf" }), null);
  assert.match(pendingPdfProblem({ name: "empty.pdf", size: 0, type: "application/pdf" })!, /empty/i);
});

test("a refused file is never stored", async () => {
  const m = memory();
  const result = await keepPendingProductPdf(new File(["x"], "notes.txt", { type: "text/plain" }), m.deps);
  assert.equal(result.ok, false);
  assert.equal(m.blobs.size, 0);
  assert.equal(m.session.size, 0);
});

test("take returns the file once and clears it", async () => {
  const m = memory();
  assert.deepEqual(await keepPendingProductPdf(pdf("zine.pdf", 7), m.deps), { ok: true });
  assert.ok(m.blobs.has(PENDING_KEY) && m.session.has(PENDING_META_KEY));
  const file = await takePendingProductPdf(m.deps);
  assert.equal(file?.name, "zine.pdf");
  assert.equal(file?.size, 7);
  assert.equal(file?.type, "application/pdf");
  assert.equal(m.blobs.size, 0, "the stored copy is removed");
  assert.equal(m.session.size, 0, "the note is removed");
  assert.equal(await takePendingProductPdf(m.deps), null, "a reload cannot upload it twice");
});

test("a file left for more than ten minutes is forgotten", async () => {
  const m = memory();
  await keepPendingProductPdf(pdf(), m.deps);
  m.now.t += PENDING_TTL_MS - 1;
  assert.ok(session(m).getItem(PENDING_META_KEY), "still waiting just inside the limit");
  m.now.t += 2;
  assert.equal(await takePendingProductPdf(m.deps), null);
  assert.equal(m.session.size, 0);
});
function session(m: ReturnType<typeof memory>) { return m.deps.session; }

test("a failing store reports a clear message instead of throwing", async () => {
  const m = memory();
  m.deps.put = async () => { throw new Error("quota"); };
  const result = await keepPendingProductPdf(pdf(), m.deps);
  assert.equal(result.ok, false);
  assert.equal(m.session.size, 0);
});

test("the sign-in return target accepts only the listed values", () => {
  assert.deepEqual([...SIGNIN_NEXT].sort(), ["account", "create", "home", "products-upload"]);
  assert.equal(signinDestination("home", false), "/");
  assert.equal(signinDestination("account", false), "/account");
  assert.equal(signinDestination("create", true), "/create");
  assert.equal(signinDestination("create", false), "/dashboard");
  assert.equal(signinDestination("products-upload", false), "/products?pending=1");
  for (const hostile of ["https://evil.example", "//evil.example", "/products?pending=1", "javascript:alert(1)", "products", "", undefined]) {
    assert.equal(signinDestination(hostile, true), "/dashboard", String(hostile));
  }
  // The page that reads the value must go through this function, never build a URL from it.
  assert.match(readFileSync("src/routes/signin.tsx", "utf8"), /signinDestination\(next/);
});

test("the editor and the product list use the pending file", () => {
  const editor = readFileSync("src/components/products/ProductEditor.tsx", "utf8");
  assert.match(editor, /takePendingProductPdf\(\)/);
  assert.match(editor, /uploadFull\(file\)/);
  assert.match(editor, /searchParams\.delete\("pending"\)/);
  const list = readFileSync("src/routes/products.tsx", "utf8");
  assert.match(list, /hasPendingProductPdf\(\)/);
  assert.match(list, /\/product-studio\/\$\{id\}\?pending=1/);
  const box = readFileSync("src/components/products/ProductUploadBox.tsx", "utf8");
  assert.match(box, /\/signin\?next=products-upload/);
  assert.ok(box.includes("Drop your product PDF here") && box.includes("Free to try. Your PDF stays private."));
});
