import test from "node:test";
import assert from "node:assert/strict";
import { readableTurnCurve, softFold } from "../src/lib/portfolia/turn-curve";

const grid = (fn: (u: number, v: number) => void) => { for (let i = 0; i <= 20; i++) for (let j = 0; j <= 4; j++) fn(i / 20, j / 4); };

test("soft fold rests exactly flat at the start and lands mirrored and flat at the end", () => {
  grid((u, v) => {
    assert.deepEqual(softFold(u, v, 0), { x: u, z: 0 });
    const end = softFold(u, v, 1);
    assert.ok(Math.abs(end.x + u) < 1e-9 && Math.abs(end.z) < 1e-9);
  });
});

test("the spine edge never moves and the sheet stays close to the paper", () => {
  for (let p = 0; p <= 1; p += .02) {
    grid((u, v) => {
      const { z } = softFold(u, v, p);
      assert.ok(z >= 0 && z <= .2, `height ${z} at u=${u} p=${p}`);
    });
    assert.deepEqual(softFold(0, .5, p), { x: 0, z: 0 });
  }
});

test("the sheet moves continuously between neighbouring frames", () => {
  for (let p = 0; p < 1; p += .01) grid((u, v) => {
    const a = softFold(u, v, p), b = softFold(u, v, p + .005);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .06, `jump at u=${u} v=${v} p=${p}`);
  });
});

test("mid-turn, the turning edge bows instead of running straight", () => {
  // Where the outer edge (u = 1) lies across the spread, from foot to head. A straight edge would be linear in v.
  const edge = [0, .25, .5, .75, 1].map((v) => softFold(1, v, .45).x);
  const straightMiddle = (edge[0]! + edge[4]!) / 2;
  assert.ok(Math.abs(edge[2]! - straightMiddle) > .03, `edge ${edge.map((x) => x.toFixed(3)).join(" ")}`);
});

test("soft is a recognised turn curve", () => assert.equal(readableTurnCurve("soft"), "soft"));
