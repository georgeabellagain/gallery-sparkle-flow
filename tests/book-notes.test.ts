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
      const flap = () => {
        const mesh = book.children[0].children[1] as THREE.Mesh;
        const pos = mesh.geometry.getAttribute("position");
        let far = 0, farPoint = new THREE.Vector3(), maxZ = -1;
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).add(book.children[0].position);
          if (v.length() > far) { far = v.length(); farPoint = v; }
          maxZ = Math.max(maxZ, v.z);
        }
        return { maxZ, mesh };
      };
      notes.progress("a", 0.5);
      const mid = flap();
      assert.ok(mid.maxZ > 0.1, "flap lifts above the book");
      assert.equal(mid.mesh.material.roughness, paper.roughness);
      // The flap bends: its points do not all lie in one plane.
      const pos = mid.mesh.geometry.getAttribute("position");
      const sample = new Set<string>();
      for (let i = 0; i < pos.count; i++) sample.add(pos.getZ(i).toFixed(4));
      assert.ok(sample.size > 8, "flap is curved while turning");
      notes.progress("a", 1);
      const opened = flap();
      assert.ok(opened.maxZ < 0.1, "open flap lies down on the page");
      const group = book.children[0];
      const centre = new THREE.Vector3();
      const box = new THREE.Box3().setFromBufferAttribute(opened.mesh.geometry.getAttribute("position") as THREE.BufferAttribute);
      box.getCenter(centre);
      if (hinge === "left") assert.ok(centre.x < 0);
      if (hinge === "right") assert.ok(centre.x > 0);
      if (hinge === "top") assert.ok(centre.y > 0);
      if (hinge === "bottom") assert.ok(centre.y < 0);
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
