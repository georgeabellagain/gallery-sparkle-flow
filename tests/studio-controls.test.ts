import test from "node:test";
import assert from "node:assert/strict";
import { studioLightMix } from "../src/lib/portfolia/lighting";
import { PAPER_STYLES, paperRelief } from "../src/lib/portfolia/surface";
import { tabSlot } from "../src/lib/portfolia/tab-geometry";

test("lighting blends from neutral top light to HDRI alone", () => {
  assert.deepEqual(studioLightMix(1), { hdri: 1, top: 0, ambient: 0 });
  assert.deepEqual(studioLightMix(0), { hdri: 0, top: 2.3, ambient: .65 });
  assert.ok(studioLightMix(.2).top > studioLightMix(.8).top);
  assert.deepEqual(studioLightMix(2), studioLightMix(1));
  assert.deepEqual(studioLightMix(NaN), studioLightMix(.75));
});
test("every paper style can flatten its relief independently of lighting", () => {
  for (const [kind] of PAPER_STYLES) {
    assert.equal(paperRelief(kind, 0), 0);
    assert.ok(paperRelief(kind, 1) > 0);
    assert.equal(paperRelief(kind, .5), paperRelief(kind, 1) / 2);
  }
});
test("dragged tabs stay fully within the top and bottom of the page", () => {
  for (const ratio of [.7, 1, 1.4]) for (const position of [0, .25, 1]) {
    const slot = tabSlot(ratio, 0, 4, position);
    assert.ok(Math.abs(slot.y) + slot.height / 2 <= ratio / 2 + 1e-9);
  }
});
