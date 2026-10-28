import { test } from "node:test";
import assert from "node:assert/strict";
import { paperLayerPlan } from "../src/lib/portfolia/paper-layers";

test("paper layers are optional, bounded, and follow the remaining leaves", () => {
  assert.deepEqual(paperLayerPlan(100, 1, .04, false), []);
  assert.equal(paperLayerPlan(1000, 1, .04, true).length, 24);
  assert.equal(paperLayerPlan(20, .5, .02, true).length, 5);
  assert.deepEqual(paperLayerPlan(20, 0, .02, true), []);
  assert.deepEqual(paperLayerPlan(2, 1, .02, true), []);
  for (const p of paperLayerPlan(30, 1, .04, true)) {
    assert.ok(p.z - p.thickness / 2 > 0);
    assert.ok(p.z + p.thickness / 2 <= .04);
    assert.ok(p.offset <= .012);
  }
});
