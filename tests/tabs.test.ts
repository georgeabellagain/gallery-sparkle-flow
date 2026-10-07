import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { planTabs, sheetEdge, tabFrame, tabSlot } from "../src/lib/portfolia/tab-geometry";
import { createBookTabs } from "../src/lib/portfolia/book-tabs";

test("tabs rest on the outer edges and ride the turning sheet", () => {
  const right = sheetEdge(0, 1, 0.5), left = sheetEdge(1, 1, 0.5);
  assert.ok(Math.abs(right.x - 1) < 1e-9 && right.tx > 0.99);
  assert.ok(Math.abs(left.x + 1) < 1e-9 && left.tx < -0.99);
  // Mid-turn the sheet's edge is lifted above the book.
  assert.ok(sheetEdge(0.5, 1, 0.5).z > 0.9);
  // Backward turns start on the left.
  assert.ok(sheetEdge(0, -1, 0.5).x < -0.99);
  // A tab that is not on the turning sheet stays put, and hops to its new edge halfway.
  const plan = { from: "right", to: "left", sheet: false } as const;
  assert.ok(tabFrame(plan, 0.2, 1, 0.5).x > 0.99);
  assert.ok(tabFrame(plan, 0.8, 1, 0.5).x < -0.99);
  assert.ok(tabFrame({ ...plan, sheet: true }, 0.5, 1, 0.5).z > 0.9);
});
test("slots keep every tab on the page and in order", () => {
  for (const n of [1, 3, 8, 24]) {
    const slots = Array.from({ length: n }, (_, i) => tabSlot(1.4, i, n));
    slots.forEach((s, i) => {
      assert.ok(s.y + s.height / 2 <= 0.7 + 1e-9 && s.y - s.height / 2 >= -0.7 - 1e-9);
      if (i) assert.ok(slots[i - 1]!.y > s.y);
    });
  }
});
test("tab plans follow the spreads", () => {
  const tabs = [{ id: "a", leaf: 5 }, { id: "b", leaf: 0 }, { id: "c", leaf: 2 }];
  const plan = planTabs(tabs, [1, 2], [3, 4], [2, 3], false);
  assert.deepEqual(plan.map((p) => [p.from, p.to, p.sheet]), [["right", "right", false], ["left", "left", false], ["right", "left", true]]);
  assert.ok(planTabs(tabs, [1, 2], [3, 4], [2, 3], true).every((p) => p.from === "right" && !p.sheet));
});
test("tab meshes are built, posed and released", () => {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({ width: 1, height: 1, getContext: () => ({ fillRect() {}, measureText: () => ({ width: 10 }), translate() {}, rotate() {}, fillText() {} }) }),
  } as unknown as Document;
  try {
    const book = new THREE.Group(), paper = new THREE.MeshPhysicalMaterial();
    const mats = [paper];
    const tabs = createBookTabs(book, 1.4, mats, () => paper, () => {});
    tabs.set([{ id: "a", text: "Work", colour: "#e8604c" }, { id: "b", text: "Contact", colour: "#4fa3d1" }], false);
    assert.equal(book.children.length, 2);
    tabs.setRest({ a: "right", b: "left" });
    const rects = tabs.rects();
    assert.ok(rects[0]!.x0 > 0.9 && rects[1]!.x1 < -0.9);
    const COLS_LAST = 8;
    const pos = (book.children[1]!.children[0] as THREE.Mesh).geometry.getAttribute("position");
    assert.ok(pos.getX(COLS_LAST) < -1.05);
    tabs.turn([{ id: "a", from: "right", to: "left", sheet: true }, { id: "b", from: "left", to: "left", sheet: false }], 0.5, 1);
    const mid = (book.children[0]!.children[0] as THREE.Mesh).geometry.getAttribute("position");
    assert.ok(mid.getZ(0) > 0.5, "tab lifts with the sheet");
    tabs.clear();
    assert.equal(book.children.length, 0);
    assert.deepEqual(mats, [paper]);
  } finally {
    globalThis.document = original;
  }
});
