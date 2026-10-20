import { test } from "node:test";
import assert from "node:assert/strict";
import { createPageReadiness } from "../src/lib/portfolia/page-readiness";

test("Scroll stays closed until all pages finish, regardless of completion order", () => {
  const gate = createPageReadiness(3);
  assert.equal(gate.mark(3, true).ready, false);
  assert.equal(gate.mark(1, true).ready, false);
  assert.equal(gate.mark(1, true).completed, 2);
  assert.deepEqual(gate.mark(2, true), { completed: 3, failed: null, ready: true });
});
test("a failed or invalid page cannot reveal an incomplete portfolio", () => {
  const gate = createPageReadiness(2);
  assert.equal(gate.mark(0, true).completed, 0);
  assert.equal(gate.mark(3, true).completed, 0);
  gate.mark(1, true);
  assert.deepEqual(gate.mark(2, false), { completed: 1, failed: 2, ready: false });
  assert.equal(gate.mark(2, true).ready, false);
});
test("a streamed PDF opens once the pages in view are ready, and a distant failure does not block it", () => {
  const gate = createPageReadiness(40, [30, 31]);
  assert.equal(gate.mark(1, true).ready, false);
  assert.equal(gate.mark(2, false).failed, null);
  assert.equal(gate.mark(30, true).ready, false);
  assert.deepEqual(gate.mark(31, true), { completed: 3, failed: null, ready: true });
  const last = createPageReadiness(3, [3, 4]);
  assert.equal(last.mark(3, true).ready, true);
  assert.equal(createPageReadiness(3, [3]).mark(3, false).failed, 3);
});
test("a new document gate cannot inherit readiness from an earlier document", () => {
  const old = createPageReadiness(1);
  assert.equal(old.mark(1, true).ready, true);
  assert.equal(createPageReadiness(3).mark(1, true).ready, false);
  assert.equal(createPageReadiness(0).mark(1, true).ready, false);
});
