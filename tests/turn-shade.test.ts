import test from "node:test";
import assert from "node:assert/strict";
import { turnShadeAt } from "../src/lib/portfolia/turn-shade";

test("no shade on either page before or after a turn", () => {
  for (const p of [0, 1]) {
    const s = turnShadeAt(p);
    assert.equal(s.source.strength, 0);
    if (p === 0) assert.equal(s.landing.strength, 0);
  }
});

test("the page left behind darkens slightly as the sheet lifts, then clears by mid-turn", () => {
  const early = turnShadeAt(0.08), mid = turnShadeAt(0.5);
  assert.ok(early.source.strength > 0.1 && early.source.strength <= 0.2);
  assert.equal(mid.source.strength, 0);
  assert.ok(turnShadeAt(0.1).source.reach > turnShadeAt(0.4).source.reach, "the shade draws in towards the spine as the sheet rises");
});

test("the page being covered darkens slowly as the sheet closes on it, spreading from the spine", () => {
  const values = [0.5, 0.65, 0.8, 0.95].map((p) => turnShadeAt(p).landing);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i]!.strength > values[i - 1]!.strength);
    assert.ok(values[i]!.reach >= values[i - 1]!.reach);
  }
  assert.ok(values[3]!.strength <= 0.32);
});
