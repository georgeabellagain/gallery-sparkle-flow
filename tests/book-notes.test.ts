import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBookNotes, stickyTurnClearance } from "../src/lib/portfolia/book-notes";
import { pageRelief } from "../src/lib/portfolia/page-relief";
import type { Foldout } from "../src/lib/portfolia/foldouts";

test("each flap lifts toward the viewer, opens outward, shares paper and releases resources", async () => {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 1,
      height: 1,
      getContext: () => ({
        save() {}, translate() {},
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
    for (const hinge of ["left", "right", "top", "bottom", "none", "sticky"] as const) {
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
        hinge: hinge === "sticky" ? "top" : hinge,
        ...(hinge === "sticky" ? { style: "sticky" as const } : {}),
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
      const closedBounds = notes.bounds();
      notes.progress("a", 0.5);
      const mid = flap();
      assert.ok(mid.maxZ > 0.1, "flap lifts above the book");
      assert.equal(mid.mesh.material.roughness, hinge === "sticky" ? .97 : paper.roughness);
      if (hinge === "sticky") { assert.equal(mid.mesh.material.clearcoat, 0); assert.ok(mid.mesh.material.bumpMap); }
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
      if (hinge === "top") {
        assert.ok(centre.y > 0);
        assert.ok(notes.bounds()!.max.y > (closedBounds?.max.y ?? -.1), "open note bounds expand above its original page position");
      }
      if (hinge === "bottom") assert.ok(centre.y < 0);
      notes.progress("a", 0);
      assert.equal(group.visible, hinge === "sticky");
      if (hinge === "sticky") {
        assert.equal(group.children.length, 4, "adhesive strip stays attached above the base and two paper faces");
        assert.ok(flap().maxZ > .04, "closed sticky note stays lifted above the page");
        const front = group.children[1] as THREE.Mesh;
        assert.equal(front.castShadow, true);
        assert.equal(front.receiveShadow, false);
        assert.equal((group.children[2] as THREE.Mesh).castShadow, false);
        const rest = Float32Array.from(front.geometry.getAttribute("position").array);
        notes.beginTurn(0);
        notes.turn(.5, -1);
        assert.deepEqual(front.geometry.getAttribute("position").array, rest, "note on the other page remains stationary");
        notes.endTurn();
        notes.beginTurn(1);
        notes.turn(.5, 1, (u, v) => ({ position: new THREE.Vector3(0, (v - .5) * 1.4, u), normal: new THREE.Vector3(1, 0, 0) }));
        const attached = front.geometry.getAttribute("position");
        for (let i = 0; i < attached.count; i++) assert.ok(attached.getX(i) + group.position.x > .02, "sticky paper stays offset from the actual turning surface");
        notes.turn(.5, 1);
        assert.ok(flap().maxZ > .2, "sticky note travels above the book with its turning page");
        notes.endTurn();
        assert.deepEqual(front.geometry.getAttribute("position").array, rest, "cancelled turn restores the attached note");
        notes.beginTurn(1);
        notes.turn(1, 1);
        const position = front.geometry.getAttribute("position");
        assert.ok(position.getX(0) + group.position.x < 0, "note lands on the opposite side of the book");
        notes.endTurn(true);
        assert.equal(group.visible, false, "completed turn hides the old page note until destination notes commit");
        const destination = [{ item, side: 0 }];
        await notes.prepare([], destination);
        const incoming = book.children[0];
        assert.equal(incoming.visible, false, "destination note waits for the page turn");
        notes.beginTurn(1);
        notes.turn(.5, 1);
        assert.equal(incoming.visible, true, "destination note is present during the turn");
        notes.turn(1, 1);
        notes.endTurn(true);
        assert.equal(incoming.visible, true, "destination note stays visible at rest");
        assert.equal(incoming.children[0].visible, false, "sticky note has no coloured base hiding the PDF underneath");
        await notes.set(destination);
        assert.equal(book.children[0], incoming, "committing the destination does not recreate or flash the note");
        assert.equal(notes.has(destination), true, "prepared destination remains ready during the viewer handoff");
        incoming.visible=false;
        assert.equal(notes.has(destination),false,"a missing visible sticky note must not be treated as ready");
        await notes.set(destination);
        assert.equal(book.children[0].visible,true,"returning to the same cached page repairs a missing visible note");
        await notes.prepare([], destination);
        const revealed = book.children[0], revealedPaper = revealed.children[1] as THREE.Mesh;
        const raised = Float32Array.from(revealedPaper.geometry.getAttribute("position").array);
        notes.beginTurn(0); notes.turn(.25, -1);
        const revealPositions = revealedPaper.geometry.getAttribute("position");
        assert.equal(revealed.visible,false,"incoming stationary note stays hidden under the covering page");
        for (let i = 0; i < revealPositions.count; i++) assert.ok(revealPositions.getZ(i) < raised[i * 3 + 2]!, "revealed note stays flat until the covering page is clear");
        notes.turn(.8, -1);
        assert.deepEqual(revealPositions.array, raised, "revealed note regains its curl smoothly after clearance");
        notes.endTurn(true);
        assert.equal(notes.has(destination), true);
        const preparing = notes.prepare(destination, []);
        assert.equal(book.children[0], revealed, "current note remains visible while the next turn prepares");
        await preparing;
        const coveredNote = book.children[0], coveredPaper = coveredNote.children[1] as THREE.Mesh;
        const coveredRest = Float32Array.from(coveredPaper.geometry.getAttribute("position").array);
        notes.beginTurn(1); notes.turn(.55, 1);
        assert.equal(coveredNote.visible,true,"covering note remains visible, rather than disappearing halfway");
        assert.deepEqual(coveredPaper.geometry.getAttribute("position").array, coveredRest,"curl is retained until the later flattening phase");
        notes.turn(.75, 1);
        assert.equal(coveredNote.visible,true,"flattened note is occluded by the page instead of hidden");
        const compressed = coveredPaper.geometry.getAttribute("position");
        for (let i = 0; i < compressed.count; i++) assert.ok(compressed.getZ(i) < coveredRest[i * 3 + 2]!, "covered sticky note is pressed below the landing sheet by 75% of the turn");
        const ceiling=.006;
        notes.turn(1,1,()=>({position:new THREE.Vector3(0,0,ceiling),normal:new THREE.Vector3(0,0,1)}));
        for(let i=0;i<compressed.count;i++)assert.ok(compressed.getZ(i)<ceiling,"covered note cannot poke through the closing sheet on its final frame");
        notes.turn(.2, 1);
        assert.deepEqual(compressed.array, coveredRest, "reversing the turn restores the curl");
        notes.endTurn();
        assert.deepEqual(compressed.array, coveredRest, "cancelling restores the stationary note");
        notes.beginTurn(0); notes.turn(1, -1); notes.endTurn(true);
        assert.equal(book.children.length, 0, "departed page notes are removed");
        await notes.prepare([], []);
        notes.beginTurn(1); notes.turn(.5, 1);
        assert.equal(book.children.length, 0, "turning another page cannot resurrect a stale sticky note");
        for (const side of [0, 1]) {
          const nearSpine = { ...item, x: side === 0 ? 1 - item.width - .01 : .01 };
          await notes.set([{ item: nearSpine, side, seed: 7 }]);
          const flatGroup = book.children[0], flatPaper = flatGroup.children[1] as THREE.Mesh;
          const positions = flatPaper.geometry.getAttribute("position");
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i) + flatGroup.position.x;
            const y = positions.getY(i) + flatGroup.position.y;
            assert.ok(positions.getZ(i) > pageRelief(Math.abs(x), y / 1.4 + .5, 7), "closed sticky note stays above its owning page surface");
            assert.ok(positions.getZ(i) - pageRelief(Math.abs(x), y / 1.4 + .5, 7) < .004, "notes next to either side of the spine rest flat without a curled free edge");
          }
          await notes.set([{ item: nearSpine, side, exterior: true }]);
          const cover = book.children[0], coverPaper = cover.children[1] as THREE.Mesh;
          const coverPositions = coverPaper.geometry.getAttribute("position");
          let curl = 0;
          for (let i = 0; i < coverPositions.count; i++) curl = Math.max(curl, coverPositions.getZ(i) - pageRelief(Math.abs(coverPositions.getX(i) + cover.position.x), (coverPositions.getY(i) + cover.position.y) / 1.4 + .5, 0));
          assert.ok(curl > .05, "first and last page notes retain their full curl beside the spine");
        }
      }
      notes.clear();
      assert.equal(book.children.length, 0);
      assert.deepEqual(mats, [paper]);
      paper.dispose();
    }
  } finally {
    globalThis.document = original;
  }
});

test("backward turns compress sticky paper near the spine without crossing the resting page", () => {
  const normal = new THREE.Vector3(-.6, 0, -.8);
  const lift = stickyTurnClearance(.05, .015, normal, .04, .03);
  assert.ok(.04 + normal.z * lift >= .032 - 1e-9, "paper stays above the underlying page");
  assert.ok(Math.abs(normal.x * lift) <= .015 * .5, "raised paper does not reach across the fold");
  assert.equal(stickyTurnClearance(.05, .4, new THREE.Vector3(0, 0, 1), .3, .03), .05, "notes away from the fold retain their curl");
  const incoming = stickyTurnClearance(-.05, .015, new THREE.Vector3(.6, 0, .8), .04, .03);
  assert.ok(.04 + .8 * incoming >= .032 - 1e-9, "the opposite face has the same clearance");
});
