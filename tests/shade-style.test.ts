import test from "node:test";
import assert from "node:assert/strict";
import { HALFTONE_STYLES, SHADE_STYLES, readableShadeStyle, shadeStyleIndex, SHADE_STYLE_GLSL } from "../src/lib/portfolia/shade-style";

test("six shading choices keep the reference order and Classic's Studio index", () => {
  assert.deepEqual(SHADE_STYLES.map(s => s.label), ["Halftone","Bold dots","Fine dots","Micro dots","Classic","Sketch"]);
  assert.deepEqual(SHADE_STYLES.map(s => shadeStyleIndex(s.id)), [1,2,3,4,0,5]);
  assert.equal(new Set(HALFTONE_STYLES.map(s=>s.frequency)).size,4);
});
test("saved legacy shades resolve to supported choices", () => {
  for(const [old,next] of [["blend","standard"],["stipple","fine-dots"],["hatch","sketch"],["crosshatch","sketch"],["classic","standard"]]) assert.equal(readableShadeStyle(old),next);
  assert.equal(readableShadeStyle(undefined),"standard");
  assert.equal(readableShadeStyle("invalid"),"standard");
});
test("shader shares swatch parameters and filters undersampled dots", () => {
  for(const s of HALFTONE_STYLES) assert.ok(SHADE_STYLE_GLSL.includes("frequency = "+s.frequency.toFixed(1)));
  assert.ok(SHADE_STYLE_GLSL.includes("fwidth(d)"));
  assert.ok(SHADE_STYLE_GLSL.includes("mix(ink, meanInk, unresolved)"));
});
