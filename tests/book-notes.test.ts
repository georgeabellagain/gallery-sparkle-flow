import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBookNotes } from "../src/lib/portfolia/book-notes";
import type { Foldout } from "../src/lib/portfolia/foldouts";

test("each flap lifts toward the viewer, opens outward, shares paper and releases resources", async () => {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 1,
      height: 1,
      getContext: () => ({
        save() {},
        restore() {},
        beginPath() {},
        rect() {},
        clip() {},
        fillRect() {},
        drawImage() {},
      }),
    }),
  } as unknown as Document;
  try {
    for (const hinge of ["left", "right", "top", "bottom", "none"] as const) {
      const book = new THREE.Group(),
        paper = new THREE.MeshPhysicalMaterial({ roughness: 0.42 });
      const mats = [paper];
      const notes = createBookNotes(
        book,
        1.4,
        mats,
        () => paper,
        () => {},
      );
      const item: Foldout = {
        id: "a",
        page: 1,
        half: "right",
        title: "Note",
        colour: "#ffffff",
        outside: { colour: "#ffffff", text: "" },
        inside: { colour: "#eeeeee", text: "" },
        hinge,
        x: 0.2,
        y: 0.3,
        width: 0.3,
        height: 0.2,
      };
      await notes.set([{ item, side: 1 }]);
      if (hinge === "none") {
        assert.equal(book.children.length, 0);
        notes.clear();
        continue;
      }
      notes.progress("a", 0.5);
      book.updateMatrixWorld(true);
      const group = book.children[0],
        pivot = group.children[1];
      const point = pivot.children[0].getWorldPosition(new THREE.Vector3());
      assert.ok(point.z > 0.1, "flap lifts above the book");
      assert.equal(
        (
          pivot.children[0] as THREE.Mesh<
            THREE.PlaneGeometry,
            THREE.MeshPhysicalMaterial
          >
        ).material.roughness,
        paper.roughness,
      );
      notes.progress("a", 1);
      book.updateMatrixWorld(true);
      const opened = pivot.children[0].getWorldPosition(new THREE.Vector3()),
        base = group.getWorldPosition(new THREE.Vector3());
      if (hinge === "left") assert.ok(opened.x < base.x);
      if (hinge === "right") assert.ok(opened.x > base.x);
      if (hinge === "top") assert.ok(opened.y > base.y);
      if (hinge === "bottom") assert.ok(opened.y < base.y);
      notes.progress("a", 0);
      assert.equal(group.visible, false);
      notes.clear();
      assert.equal(book.children.length, 0);
      assert.deepEqual(mats, [paper]);
      paper.dispose();
    }
  } finally {
    globalThis.document = original;
  }
});
