import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { turnGeometryWriter, writePointerFold } from "../src/lib/portfolia/turn-geometry-cache";
import { TAB_STYLES, readableTabStyle, tabOutline } from "../src/lib/portfolia/tab-style";

test("a soft turn that follows the pointer lands in exactly the resting page's shape", () => {
  const ratio = 1.4, seeds = [3, 7], resting = [5, 9], gap = 0.002;
  for (const dir of [1, -1] as const) {
    const followed = new THREE.PlaneGeometry(1, 1, 32, 16), baked = followed.clone();
    for (const grabY of [0.2, 0.7, 1.2]) {
      writePointerFold(followed, ratio, dir, grabY, { x: -1, y: grabY }, resting, gap, seeds);
      turnGeometryWriter(baked, ratio, dir, seeds, resting, gap, "soft")(1, baked);
      const a = followed.getAttribute("position").array, b = baked.getAttribute("position").array;
      let worst = 0;
      for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i]! - b[i]!));
      assert.ok(worst < 1e-6, `landing differs by ${worst} (dir ${dir}, grab ${grabY})`);
    }
  }
});

test("every page tab style traces a closed outline", () => {
  assert.equal(readableTabStyle("nope"), "rounded");
  for (const style of TAB_STYLES.map((s) => s.id)) {
    const calls: string[] = [];
    const record = (name: string) => () => { calls.push(name); };
    tabOutline({ beginPath: record("begin"), moveTo: record("move"), lineTo: record("line"), arcTo: record("arc"), closePath: record("close") }, style, 96, 300);
    assert.equal(calls[0], "begin");
    assert.equal(calls.at(-1), "close");
    assert.ok(calls.length >= 5, style);
  }
});
