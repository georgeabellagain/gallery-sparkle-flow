import test from "node:test";
import assert from "node:assert/strict";
import { constrainFoldPointer, pointerFold, pointerFoldProgress, readableTurnCurve, softFold } from "../src/lib/portfolia/turn-curve";

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

test("a pointer turn: the grabbed point lands under the pointer, and the spine never moves", () => {
  const ratio = 1.4, grabY = 0.3;
  for (const target of [{ x: 0.4, y: 0.5 }, { x: 0.2, y: 0.1 }, { x: -0.3, y: 0.6 }]) {
    const at = constrainFoldPointer(grabY, target, ratio);
    const grabbed = pointerFold(1, grabY, grabY, at);
    // Seen from above, the grabbed point sits exactly at the pointer (lifted by the roll's height).
    assert.ok(Math.hypot(grabbed.x - at.x, grabbed.y - at.y) < 1e-9, `grabbed point ${JSON.stringify(grabbed)} vs ${JSON.stringify(at)}`);
    for (const y of [0, 0.7, 1.4]) { const s = pointerFold(0, y, grabY, at); assert.equal(s.x, 0); assert.equal(s.z, 0); }
  }
});

test("a pointer turn's fold follows the pointer's direction: pulling up slants it the other way to pulling down", () => {
  const ratio = 1.4, grabY = 0.7;
  const up = constrainFoldPointer(grabY, { x: 0.2, y: 1.1 }, ratio), down = constrainFoldPointer(grabY, { x: 0.2, y: 0.3 }, ratio);
  const edgeX = (at: { x: number; y: number }, y: number) => pointerFold(1, y, grabY, at).x;
  // Like a real sheet pulled by one point, the far end of the edge swings round further than the near end.
  assert.ok(edgeX(up, 0) < edgeX(up, 1.4), "pulling up carries the foot of the edge further across than the head");
  assert.ok(edgeX(down, 0) > edgeX(down, 1.4), "pulling down does the opposite");
});

test("a pointer turn rests flat at home and lies mirrored flat on the far side", () => {
  const grabY = 0.5;
  assert.deepEqual(pointerFold(0.6, 0.9, grabY, { x: 1, y: grabY }), { x: 0.6, y: 0.9, z: 0 });
  const across = pointerFold(0.6, 0.9, grabY, { x: -1, y: grabY });
  assert.ok(Math.abs(across.x + 0.6) < 1e-9 && Math.abs(across.y - 0.9) < 1e-9 && across.z === 0);
  assert.equal(pointerFoldProgress({ x: 1, y: 0 }), 0);
  assert.equal(pointerFoldProgress({ x: -1, y: 0 }), 1);
});

test("the pointer is held where bound paper can reach", () => {
  const ratio = 1.4, grabY = 0.7;
  const far = constrainFoldPointer(grabY, { x: -3, y: 4 }, ratio);
  assert.ok(Math.hypot(far.x, far.y - grabY) <= 1 + 1e-9);
  // Nothing on the spine is ever lifted or moved, wherever the pointer is pulled.
  for (const target of [{ x: -3, y: 4 }, { x: 0.1, y: -2 }, { x: -0.9, y: 0.7 }]) {
    const at = constrainFoldPointer(grabY, target, ratio);
    for (const y of [0, 0.35, 0.7, 1.05, 1.4]) assert.deepEqual(pointerFold(0, y, grabY, at), { x: 0, y, z: 0 });
  }
  void far;
});

test("soft is a recognised turn curve", () => assert.equal(readableTurnCurve("soft"), "soft"));
