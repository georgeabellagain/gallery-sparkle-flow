import { test } from "node:test";
import assert from "node:assert/strict";
import { paperLayerPlan, paperLayerShade } from "../src/lib/portfolia/paper-layers";

test("paper layers are optional, bounded, and follow the remaining leaves", () => {
  assert.deepEqual(paperLayerPlan(100, 1, .04, false), []);
  assert.equal(paperLayerPlan(1000, 1, .04, true).length, 24);
  assert.equal(paperLayerPlan(20, .5, .02, true).length, 5);
  assert.deepEqual(paperLayerPlan(20, 0, .02, true), []);
  assert.deepEqual(paperLayerPlan(2, 1, .02, true), []);
  for (const p of paperLayerPlan(30, 1, .04, true)) {
    assert.ok(p.z - p.thickness / 2 > 0);
    assert.ok(p.z + p.thickness / 2 <= .04);
    assert.ok(p.offset <= .032);
  }
});

test("offsets are visible, bounded and omitted behind page 2 and the last page", () => {
  for(const leaf of [0, 1, 19]) assert.deepEqual(paperLayerPlan(20, .5, .03, true, leaf), []);
  const middle=paperLayerPlan(20,.5,.03,true,8);
  assert.ok(middle.length>0);
  assert.ok(middle[0]!.offset>.012);
  assert.equal(middle.at(-1)!.offset,.032);
  assert.deepEqual(paperLayerPlan(20,1,.03,true,NaN),[]);
});
test("paper contact shading is subtle and fades smoothly to clean edges", () => {
  assert.equal(paperLayerShade(0,.5),1);
  assert.equal(paperLayerShade(1,.5),1);
  assert.equal(paperLayerShade(.5,.5),.9);
  assert.ok(paperLayerShade(.01,.5)>paperLayerShade(.02,.5));
  assert.equal(paperLayerShade(.02,.5),paperLayerShade(.5,.02));
});
