import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultPreviewPages, nextProductStep, productAllowance } from "../src/lib/products/plan";

test("Free is a try-out; publishing and room grow with the plan", () => {
  assert.deepEqual(productAllowance("free"), { products: 1, mb: 30, publish: false });
  assert.deepEqual(productAllowance("personal"), { products: 10, mb: 100, publish: true });
  assert.deepEqual(productAllowance("business"), { products: 50, mb: 250, publish: true });
  assert.equal(productAllowance("other" as never).publish, false);
});

test("every product points at one next step", () => {
  assert.equal(nextProductStep({ status: "draft", hasFile: false, hasPreview: false }), "upload");
  assert.equal(nextProductStep({ status: "draft", hasFile: true, hasPreview: false }), "preview");
  assert.equal(nextProductStep({ status: "draft", hasFile: true, hasPreview: true }), "publish");
  assert.equal(nextProductStep({ status: "published", hasFile: true, hasPreview: true }), "share");
});

test("the first preview is the cover and first spread, within the PDF", () => {
  assert.deepEqual(defaultPreviewPages(40), [1, 2, 3]);
  assert.deepEqual(defaultPreviewPages(2), [1, 2]);
  assert.deepEqual(defaultPreviewPages(1), [1]);
});

test("the database enforces the same allowances and the publish rule", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261110130000_product_studio_plans.sql", import.meta.url), "utf8");
  for (const plan of ["free", "personal", "business"] as const) {
    const a = productAllowance(plan);
    assert.ok(sql.includes(String(a.mb * 1048576)), `${plan} upload bytes`);
    if (plan !== "free") assert.ok(sql.includes(`WHEN '${plan}' THEN ${a.products}`), `${plan} product count`);
  }
  assert.match(sql, /product_publish_guard BEFORE INSERT OR UPDATE OF status/);
});

test("owner responses never include a link's token hash or signing secret", () => {
  const source = readFileSync(new URL("../src/lib/products/functions.ts", import.meta.url), "utf8");
  const owner = source.slice(source.indexOf("export const ownerProduct"), source.indexOf("export const saveProduct"));
  assert.ok(!/token_hash|secret:/.test(owner.slice(owner.indexOf("links: ("))));
});
