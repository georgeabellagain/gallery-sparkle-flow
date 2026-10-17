import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { clothTextures, hasHeadbands, hasRibbon, readableRibbonColour, ribbonGeometry, ribbonGutterFor, ribbonPlacement, ribbonShadowGeometry, RIBBON_COLOURS, DEFAULT_RIBBON_COLOUR } from "../src/lib/portfolia/book-details";
import { bookLayout } from "../src/lib/portfolia/book-layout";
import { PAGE_TOP } from "../src/lib/portfolia/rigid-cover";
import { createBookBinding } from "../src/lib/portfolia/book-binding";
import { flatCamera, SHOOT_ELEVATION, SHOOT_PRESETS } from "../src/lib/portfolia/photo-shoot";

test("ribbon and headbands belong only to bound books, with safe colour defaults", () => {
  assert.equal(hasHeadbands("hardback"), true);
  for (const style of ["softcover", "flipbook", undefined]) assert.equal(hasHeadbands(style), false);
  assert.equal(hasRibbon("hardback", true), true); assert.equal(hasRibbon("softcover", true), true);
  assert.equal(hasRibbon("flipbook", true), false); assert.equal(hasRibbon("hardback", undefined), false);
  assert.equal(readableRibbonColour("#1F3A5F"), "#1F3A5F");
  for (const bad of [undefined, "red", "#12345", "javascript:alert(1)"]) assert.equal(readableRibbonColour(bad), DEFAULT_RIBBON_COLOUR);
  assert.ok(RIBBON_COLOURS.every(c => readableRibbonColour(c) === c));
});

test("ribbon strip keeps its width along the whole path", () => {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(.02, -.05, -.02), new THREE.Vector3(.05, -.1, -.06), new THREE.Vector3(.1, -.13, -.067)];
  const geometry = ribbonGeometry(points, .03, new THREE.Vector3(0, 0, 1)), p = geometry.getAttribute("position");
  // Each row is three points across the top face and three across the bottom; the last row is notched.
  const rows = p.count / 6;
  for (let row = 0; row < rows; row++) for (const face of [0, 3]) {
    const a = row * 6 + face, b = a + 2;
    const width = Math.hypot(p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a));
    assert.ok(Math.abs(width - .03) < 1e-6);
  }
  // The two faces are a silk's thickness apart.
  const gap = Math.hypot(p.getX(3) - p.getX(0), p.getY(3) - p.getY(0), p.getZ(3) - p.getZ(0));
  assert.ok(gap > .0005 && gap < .0012);
  // The V notch: the middle of the free end sits back from its corners, along the ribbon.
  const at = (i: number) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
  const end = (rows - 1) * 6, mid = at(end).add(at(end + 2)).multiplyScalar(.5);
  const before = at(end - 6).add(at(end - 4)).multiplyScalar(.5), tangent = mid.clone().sub(before).normalize();
  assert.ok(at(end + 1).sub(mid).dot(tangent) < -.01, "a V is cut into the free end");
  // Rebuilding into the same geometry reuses it.
  assert.equal(ribbonGeometry(points, .02, new THREE.Vector3(0, 0, 1), geometry), geometry);
  geometry.dispose();
});

test("book cloth tiles without a seam", () => {
  const { normal } = clothTextures(), size = normal.image.width, data = normal.image.data as Uint8Array;
  const at = (x: number, y: number, c: number) => data[(y * size + x) * 4 + c]!;
  let jump = 0;
  for (let y = 0; y < size; y++) for (let c = 0; c < 3; c++) jump = Math.max(jump, Math.abs(at(0, y, c) - at(size - 1, y, c)));
  assert.ok(jump < 140, "left and right edges meet");
  assert.equal(normal.wrapS, THREE.RepeatWrapping);
});

test("the ribbon drapes onto the table, only when switched on, on the side the book lies", () => {
  const root = new THREE.Group(), binding = createBookBinding(root, 1.4);
  const ribbon = root.children[0]!.children.find(o => o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).side === THREE.DoubleSide) as THREE.Mesh;
  binding.set("hardback", true); binding.sync([true, true]);
  assert.equal(ribbon.visible, false, "off by default");
  binding.setDetails({ ribbon: true, ribbonColour: "#1f3a5f" }); binding.sync([true, true]);
  assert.equal(ribbon.visible, true);
  assert.equal((ribbon.material as THREE.MeshStandardMaterial).color.getHexString(), "1f3a5f");
  root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(ribbon);
  assert.ok(box.min.z > -.07, "never sinks through the table"); assert.ok(box.min.y < -.7, "hangs below the foot of the page");
  binding.sync([true, false]); root.updateMatrixWorld(true);
  // The strip is .03 wide, so its edge may cross the spine by half that where it leaves the gutter.
  assert.ok(new THREE.Box3().setFromObject(ribbon).max.x <= .006, "follows a closed back cover to the left");
  binding.set("flipbook", true); binding.sync([true, true]); assert.equal(ribbon.visible, false);
  binding.dispose();
});

test("flat-lay camera looks down on the book from within its allowed heights", () => {
  const centre = new THREE.Vector3(0, .02, 2.2);
  for (const elevation of [0, 40, 72, 88, 120]) {
    const pose = flatCamera(0, elevation, 1, 1.4, .8, 2, centre), dir = pose.target.clone().sub(pose.position).normalize();
    const pitch = THREE.MathUtils.radToDeg(Math.asin(-dir.y));
    assert.ok(pitch >= 40 - 1e-6 && pitch <= 88 + 1e-6);
    assert.ok(pose.position.y > centre.y);
  }
  for (const preset of SHOOT_PRESETS) {
    const [low, high] = SHOOT_ELEVATION[preset.layout];
    assert.ok(preset.elevation >= low && preset.elevation <= high, preset.id);
  }
});

test("the marked page decides where the ribbon is", () => {
  // Twelve single pages: [null,0] [1,2] [3,4] ... gutters 0, 2, 4, ...
  const layout = bookLayout(12, false);
  assert.equal(ribbonGutterFor(undefined, layout), undefined);
  assert.equal(ribbonGutterFor(99, layout), undefined);
  assert.equal(ribbonGutterFor(1, layout), 0);
  assert.equal(ribbonGutterFor(4, layout), 4, "page 4 is leaf 3, on spread [3,4]");
  assert.equal(ribbonGutterFor(5, layout), 4);
  const ready = bookLayout(6, true);
  assert.equal(ribbonGutterFor(2, ready), 3, "a ready spread's gutter is its right half");
  assert.deepEqual(ribbonPlacement(undefined, 1, 2, 12), { mode: "default" });
  assert.deepEqual(ribbonPlacement(4, 3, 4, 12), { mode: "open" });
  const before = ribbonPlacement(8, 3, 4, 12), after = ribbonPlacement(2, 5, 6, 12);
  assert.equal(before.mode === "tail" && before.side, 1, "pages before the mark: held in the right-hand block");
  assert.equal(after.mode === "tail" && after.side, -1, "pages after the mark: held in the left-hand block");
  assert.ok(before.mode === "tail" && before.depth > 0 && before.depth < 1);
  // Closed books hold it in their only block, never on an invisible side.
  assert.deepEqual(ribbonPlacement(0, undefined, 0, 12), { mode: "tail", side: 1, depth: 0 });
  assert.equal((ribbonPlacement(4, 11, undefined, 12) as { side: number }).side, -1);
  // While a sheet turns, the resting pages straddle it: never lying open.
  for (const [left, right] of [[3, 6], [1, 4], [undefined, 2]] as const)
    for (let mark = 0; mark <= 12; mark += 2) assert.notEqual(ribbonPlacement(mark, left, right, 12).mode, "open");
});

test("the ribbon lies on the open marked spread and stays inside the block otherwise", () => {
  const root = new THREE.Group(), binding = createBookBinding(root, 1.4);
  const ribbon = root.children[0]!.children.find(o => o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).side === THREE.DoubleSide && !(o.material instanceof THREE.MeshBasicMaterial)) as THREE.Mesh;
  binding.set("hardback", true); binding.setLeaves(12);
  binding.setDetails({ ribbon: true, ribbonGutter: 4 });
  const side = (leaf: number) => ({ kind: "page" as const, share: .5, leaf });
  binding.sync([true, true], [side(3), side(4)]); root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(ribbon);
  assert.ok(box.max.y > .65, "starts at the head of the gutter");
  assert.ok(box.min.y < -.7, "runs out past the foot");
  assert.ok(box.max.z > .005, "lies on the paper, above the block");
  binding.sync([true, true], [side(1), side(2)]); root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(ribbon);
  assert.ok(box.max.y < -.6, "only a tail at the foot on other spreads");
  assert.ok(box.min.x > -.01, "held in the right-hand block before the marked page");
  // Inside the page block where it overlaps the page area, so a turning sheet above can never meet it.
  const p = ribbon.geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) if (p.getY(i) > -.7) assert.ok(p.getZ(i) <= PAGE_TOP + .002);
  binding.sync([true, true], [side(5), side(6)]); root.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(ribbon).max.x < .01, "held in the left-hand block after it");
  binding.dispose();
});

test("ribbon contact shadow only darkens where the silk rests on a surface", () => {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -.1, 0), new THREE.Vector3(0, -.15, -.05), new THREE.Vector3(.05, -.2, -.06)];
  const shadow = ribbonShadowGeometry(points, .03, new THREE.Vector3(0, 0, 1), undefined, 30, { contact: [1, 1, 0, 1] });
  const colour = shadow.getAttribute("color");
  for (let i = 0; i < colour.count; i++) if (i % 3 !== 1) assert.equal(colour.getW(i), 0, "edges fade to nothing");
  assert.ok(colour.getW(1) > .5 && colour.getW(3 * 20 + 1) < colour.getW(4));
});