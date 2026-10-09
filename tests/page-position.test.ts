import { test } from "node:test";
import assert from "node:assert/strict";
import { pageWorldRect } from "../src/lib/portfolia/page-position";

const viewport = { left: 20, top: 50, width: 1000, height: 800 };
const page = { left: 120, top: 150, width: 800, height: 600 };
test("a centred DOM page aligns with the fixed camera's world centre", () => {
  const p = pageWorldRect(page, viewport);
  assert.equal(p.x, 0); assert.equal(p.y, 0);
  assert.ok(Math.abs(p.width - 1.84) < 1e-10);
  assert.ok(Math.abs(p.height - 1.38) < 1e-10);
});
test("scrolling and sliding move paper through fixed light coordinates", () => {
  const start = pageWorldRect(page, viewport);
  const scrolled = pageWorldRect({ ...page, top: page.top - 200 }, viewport);
  const slid = pageWorldRect({ ...page, left: page.left + 100 }, viewport);
  assert.ok(Math.abs(scrolled.y - start.y - .46) < 1e-10);
  assert.ok(Math.abs(slid.x - start.x - .23) < 1e-10);
  assert.equal(scrolled.width, start.width); assert.equal(scrolled.height, start.height);
});
test("moving the whole reader in the document does not move pages relative to its light", () => {
  assert.deepEqual(pageWorldRect({ ...page, top: page.top + 150 }, { ...viewport, top: viewport.top + 150 }), pageWorldRect(page, viewport));
});
