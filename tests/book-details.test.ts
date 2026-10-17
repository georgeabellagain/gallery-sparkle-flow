import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { clothTextures, hasHeadbands, hasRibbon, readableRibbonColour, ribbonGeometry, RIBBON_COLOURS, DEFAULT_RIBBON_COLOUR } from "../src/lib/portfolia/book-details";
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
  for (let i = 0; i < p.count; i += 2) {
    const width = Math.hypot(p.getX(i + 1) - p.getX(i), p.getY(i + 1) - p.getY(i), p.getZ(i + 1) - p.getZ(i));
    assert.ok(Math.abs(width - .03) < 1e-6);
  }
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
