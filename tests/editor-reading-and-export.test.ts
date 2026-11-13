import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { showsSinglePage, wantsRotateHint } from "../src/lib/portfolia/orientation";
import { LEAN_TILT, shootLight } from "../src/lib/portfolia/photo-shoot";
import { VIDEO_HOLD_SECONDS, VIDEO_TURN_PACES, videoHoldMs, videoTurnPace } from "../src/lib/portfolia/studio-recorder";
import { foldoutsForPage, type Foldout } from "../src/lib/portfolia/foldouts";
import { SECTION_OF } from "../src/lib/portfolia/page-sections";
import { createBookBinding, spineFit } from "../src/lib/portfolia/book-binding";
import { pageRelief } from "../src/lib/portfolia/page-relief";

test("phones show the whole spread when held sideways, and are asked to turn only when upright", () => {
  assert.equal(showsSinglePage(390, 700), true);
  assert.equal(showsSinglePage(700, 390), false, "a phone turned sideways shows the spread");
  assert.equal(showsSinglePage(1200, 800), false);
  assert.equal(wantsRotateHint({ touch: true, width: 390, height: 844, mode: "book" }), true);
  assert.equal(wantsRotateHint({ touch: true, width: 844, height: 390, mode: "book" }), false);
  assert.equal(wantsRotateHint({ touch: true, width: 390, height: 844, mode: "scroll" }), false);
  assert.equal(wantsRotateHint({ touch: false, width: 390, height: 844, mode: "book" }), false);
  assert.equal(wantsRotateHint({ touch: true, width: 820, height: 1180, mode: "book" }), false, "tablets are big enough upright");
});

test("the photo-shoot light aims at the book and meets a flat-lay book at a leaning book's angle", () => {
  const ratio = 1.4, preset: [number, number, number] = [2, 4, 3];
  const leanFocus = new THREE.Vector3(0, ratio * 0.5, 0);
  const lean = shootLight(preset, ratio, leanFocus, false);
  assert.deepEqual(lean.position.toArray(), preset, "unchanged for the book the presets were made for");
  const flatFocus = new THREE.Vector3(0, ratio * 0.62, -0.1);
  const flat = shootLight(preset, ratio, flatFocus, true);
  assert.deepEqual(flat.target.toArray(), flatFocus.toArray());
  // The leaning book's face points up by the tilt; turning the light by the same amount keeps the angle between them.
  const leanNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), -LEAN_TILT);
  const angle = (light: THREE.Vector3, focus: THREE.Vector3, normal: THREE.Vector3) => light.clone().sub(focus).normalize().angleTo(normal);
  assert.ok(Math.abs(angle(lean.position, leanFocus, leanNormal) - angle(flat.position, flatFocus, new THREE.Vector3(0, 0, 1))) < 1e-9);
});

test("video pace choices are bounded and default to the old timing", () => {
  assert.equal(videoTurnPace(undefined), 1);
  assert.equal(videoHoldMs(undefined), 1600);
  assert.equal(videoTurnPace(9), 2);
  assert.equal(videoHoldMs(60_000), 8000);
  assert.equal(videoHoldMs(-5), 500);
  assert.ok(VIDEO_TURN_PACES.every((p) => videoTurnPace(p.pace) === p.pace));
  assert.ok(VIDEO_HOLD_SECONDS.every((s) => videoHoldMs(s * 1000) === s * 1000));
});

test("notes keep their place in Scroll and Page by page, including on two-page sheets", () => {
  const note = { id: "n", page: 3, half: "right", x: 0.2, y: 0.1, width: 0.4, height: 0.3 } as Foldout;
  assert.deepEqual(foldoutsForPage([note], 3, false)[0], note);
  const split = foldoutsForPage([note, { ...note, id: "m", half: "left" }], 3, true);
  assert.deepEqual(split.map((n) => [n.x, n.width]), [[0.6, 0.2], [0.1, 0.2]]);
  assert.deepEqual(foldoutsForPage([note], 4, false), []);
});

test("a closed book's spine tucks under its covers and stops level with them", () => {
  for (const style of ["hardback", "softcover"] as const) {
    const book = new THREE.Group(), binding = createBookBinding(book, 1.4);
    binding.set(style, true); binding.setLeaves(20);
    binding.sync([false, true], [{ kind: "page", share: 1 }, { kind: style === "hardback" ? "closed" : "page", share: 1 }]);
    book.updateMatrixWorld(true);
    const boxes: THREE.Box3[] = [];
    book.traverse((o) => { const m = o as THREE.Mesh; let shown = true; for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) shown = false; if (m.isMesh && shown && m.geometry.attributes["position"]) { m.geometry.computeBoundingBox(); boxes.push(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
    // The spine is the one narrow part across the book's width.
    const width = (b: THREE.Box3) => b.max.x - b.min.x;
    const spine = boxes.reduce((a, b) => (width(b) < width(a) ? b : a));
    const covers = boxes.filter((b) => b !== spine);
    const fit = spineFit(style);
    assert.ok(spine.max.x >= fit.round + .001, `${style}: the spine reaches in past the covers' rounded edge`);
    // A soft cover is paper, which rises to the page relief at the spine; a hardback's top is its front board.
    const coverTop = style === "hardback" ? Math.max(...covers.map((b) => b.max.z)) : pageRelief(0, .5, 0), coverHead = Math.max(...covers.map((b) => b.max.y));
    assert.ok(spine.max.z <= coverTop + 1e-6, `${style}: the spine is not higher than the cover`);
    assert.ok(spine.max.y <= coverHead - fit.round + 1e-6, `${style}: the spine does not stand past the head`);
  }
});

test("every kind of page item belongs to one of the editor's page tools", () => {
  const kinds = ["foldouts", "hotspots", "slideshows", "videos", "stickers", "tags", "links", "jumps", "spotlights"] as const;
  for (const kind of kinds) assert.ok(SECTION_OF[kind], kind);
  assert.equal(new Set(Object.values(SECTION_OF)).size, 6);
});
