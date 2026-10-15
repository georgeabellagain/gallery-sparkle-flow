import test from "node:test";
import assert from "node:assert/strict";
import { studioLightMix, presetDirectLight, studioExposure } from "../src/lib/portfolia/lighting";
import { PAPER_STYLES, paperRelief, paperFinish } from "../src/lib/portfolia/surface";
import { tabSlot } from "../src/lib/portfolia/tab-geometry";

test("diffusion removes HDRI detail without adding top or ambient light", () => {
  assert.deepEqual(studioLightMix(1), { hdri: 1, top: 0, ambient: 0 });
  assert.deepEqual(studioLightMix(0), { hdri: 0, top: 0, ambient: 0 });
  assert.equal(studioLightMix(.2).top, 0);
  assert.equal(studioLightMix(.8).ambient, 0);
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

test("window and blinds retain their direct-light pattern at full preset strength", () => {
  for (const preset of ["7", "8"] as const) {
    assert.equal(presetDirectLight(preset, 0), 0);
    assert.equal(presetDirectLight(preset, 1), 1.4);
    assert.equal(presetDirectLight(preset, .5), .7);
  }
  assert.equal(presetDirectLight("1", 1), 0);
});

test("brightness extends past the old maximum without changing existing exposure", () => {
  assert.ok(Math.abs(studioExposure(1) - 2.15) < 1e-9);
  assert.ok(studioExposure(2) > studioExposure(1));
  assert.equal(studioExposure(3), studioExposure(2));
});

test("diffused solid colour keeps the environment's average radiance", async () => {
  const { averageEnvironment } = await import("../src/lib/portfolia/environment-diffusion");
  const colour = averageEnvironment(new Float32Array([.2,.4,.8, .4,.6,1]), 2, 1);
  for (const [i, expected] of [.3,.5,.9].entries()) assert.ok(Math.abs(colour[i]! - expected) < 1e-6);
});

test("only matte and satin are offered and older finishes resolve safely",()=>{
 assert.deepEqual(PAPER_STYLES.map(([id])=>id),["matte","satin"]);
 assert.equal(paperFinish("satin"),"satin");
 for(const kind of ["linen","natural","cotton","recycled","textured","watercolour","laid"] as const)assert.equal(paperFinish(kind),"matte");
});
