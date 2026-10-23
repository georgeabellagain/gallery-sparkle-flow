import test from "node:test";
import assert from "node:assert/strict";
import { turnShadeAt } from "../src/lib/portfolia/turn-shade";

test("no shade on either page before or after a turn", () => {
  for (const p of [0, 1]) {
    const s = turnShadeAt(p);
    assert.equal(s.source.strength, 0);
    assert.equal(s.landing.strength, 0);
  }
});

test("the page being left is shaded under the lifting sheet, following its edge in to the spine", () => {
  const early = turnShadeAt(0.1), later = turnShadeAt(0.4);
  assert.ok(early.source.strength > 0.35 && early.source.strength <= 0.45, "clearly visible, never black");
  assert.ok(early.source.edge > later.source.edge, "the shaded part shrinks towards the spine as the sheet rises");
  assert.ok(later.source.spread > early.source.spread, "a higher sheet casts a softer, wider shadow");
  assert.equal(turnShadeAt(0.95).source.strength, 0, "clear once the sheet has gone over");
});

test("the page being covered darkens as the sheet comes down over it, out to the sheet's edge", () => {
  const values = [0.55, 0.7, 0.85].map((p) => turnShadeAt(p).landing);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i]!.strength >= values[i - 1]!.strength);
    assert.ok(values[i]!.edge > values[i - 1]!.edge);
  }
  assert.ok(values[2]!.strength > 0.45 && values[2]!.strength <= 0.5);
  // Both pages are shaded together while the sheet is upright.
  const upright = turnShadeAt(0.5);
  assert.ok(upright.source.strength > 0.2 && upright.landing.strength > 0.2);
});
