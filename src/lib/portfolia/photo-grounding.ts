import * as THREE from "three";

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/**
 * Shadow strength at a point of a decal (u, v in -1..1). A superellipse of exponent `round` (2 is an ellipse,
 * higher squarer) fades to exactly zero at its rim, so no edge of the plane ever shows. `core` is the share of
 * the radius that stays dark; `foot` (0..1) moves the darkness toward v=-1, where the book meets the surface.
 */
export function shadowAlpha(u: number, v: number, round: number, core: number, foot = 0) {
  const d = Math.pow(Math.pow(Math.abs(u), round) + Math.pow(Math.abs(v), round), 1 / round);
  if (d >= 1) return 0;
  const falloff = 1 - smooth((d - core) / (1 - core));
  const lean = foot ? Math.pow(1 - smooth((v + 1) / 2), foot * 1.6) * foot + (1 - foot) : 1;
  return falloff * falloff * lean;
}
function shadowTexture(round: number, core: number, foot = 0) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const a = shadowAlpha((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1, round, core, foot);
      pixels[(y * size + x) * 4 + 3] = Math.round(a * 255);
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
/** Alpha fading from one edge to the other: darkest at v=1 (the wall/floor corner). */
function fadeTexture() {
  const pixels = new Uint8Array(128 * 4);
  for (let y = 0; y < 128; y++) { const t = y / 127; pixels[y * 4 + 3] = Math.round(255 * Math.pow(t, 2.2)); }
  const texture = new THREE.DataTexture(pixels, 1, 128);
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

/**
 * Contact shadows and corner occlusion that ground the photographed book. Real photographs always show a
 * dark seam where an object meets the floor and a soft darkening behind it on the wall; a shadow map alone
 * is too sharp and too faint to give that. Every decal is rounded and fades to nothing, so none reads as a
 * rectangle; only the thin contact decal is dark.
 */
export function createPhotoGrounding(scene: THREE.Scene, floorY: number, wallZ: number) {
  const contact = shadowTexture(3.2, .35), soft = shadowTexture(2.2, .05), behindMap = shadowTexture(2.4, .1, .85), fade = fadeTexture();
  const plane = new THREE.PlaneGeometry(1, 1);
  const decal = (map: THREE.Texture, opacity: number) => new THREE.MeshBasicMaterial({
    map, color: 0x000000, transparent: true, opacity, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const make = (material: THREE.MeshBasicMaterial, floor: boolean) => {
    const mesh = new THREE.Mesh(plane, material);
    if (floor) mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1; scene.add(mesh); return mesh;
  };
  const footprint = make(decal(contact, .7), true), spread = make(decal(soft, .34), true);
  const behind = make(decal(behindMap, .3), false);
  const cornerFloor = make(decal(fade, .14), true), cornerWall = make(decal(fade, .1), false);
  cornerWall.rotation.z = Math.PI; // darkest at the floor
  cornerFloor.scale.set(30, .32, 1); cornerFloor.position.set(0, floorY + .0006, wallZ + .16);
  cornerWall.scale.set(30, .24, 1); cornerWall.position.set(0, floorY + .12, wallZ + .0006);
  return {
    /**
     * `bounds` is the book's world box; `depth` its thickness. Leaning, the book touches the floor along its
     * foot and the wall behind it; lying flat, its whole underside meets the floor.
     */
    update(bounds: THREE.Box3, depth: number, layout: "lean" | "flat" = "lean") {
      const width = bounds.max.x - bounds.min.x, cx = (bounds.min.x + bounds.max.x) / 2, height = bounds.max.y - floorY;
      behind.visible = layout === "lean";
      if (layout === "flat") {
        const length = bounds.max.z - bounds.min.z, cz = (bounds.min.z + bounds.max.z) / 2;
        // The rounded core sits just inside the outline, so the dark band hugs the edges the book rests on.
        footprint.scale.set(width * 1.08, length * 1.08, 1);
        footprint.position.set(cx, floorY + .0008, cz);
        spread.scale.set(width * 1.45, length * 1.4, 1);
        spread.position.set(cx + .02, floorY + .0007, cz + .03);
        return;
      }
      footprint.scale.set(width * 1.1, depth + .07, 1);
      footprint.position.set(cx, floorY + .0008, bounds.max.z - depth / 2 - .005);
      spread.scale.set(width * 1.5, depth + .6, 1);
      spread.position.set(cx, floorY + .0007, bounds.max.z - depth / 2 - .06);
      behind.scale.set(width * 1.35, height * 1.3, 1);
      behind.position.set(cx + width * .02, floorY + height * .62, wallZ + .0008);
    },
    dispose() {
      for (const mesh of [footprint, spread, behind, cornerFloor, cornerWall]) { scene.remove(mesh); (mesh.material as THREE.Material).dispose(); }
      plane.dispose(); contact.dispose(); soft.dispose(); behindMap.dispose(); fade.dispose();
    },
  };
}
