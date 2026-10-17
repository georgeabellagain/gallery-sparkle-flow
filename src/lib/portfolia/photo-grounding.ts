import * as THREE from "three";

/** A soft rectangular shadow in the alpha channel; drawn once with a canvas shadow (supported everywhere). */
function softRectTexture(blur: number) {
  const size = 256, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!, pad = blur * 1.6, shift = size * 4;
  ctx.shadowColor = "rgba(0,0,0,1)"; ctx.shadowBlur = blur; ctx.shadowOffsetX = shift;
  ctx.fillStyle = "#000"; ctx.fillRect(pad - shift, pad, size - 2 * pad, size - 2 * pad);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
/** Alpha fading from one edge to the other: darkest at v=1 (the wall/floor corner). */
function fadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4; canvas.height = 128;
  const ctx = canvas.getContext("2d")!, gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "rgba(0,0,0,1)"); gradient.addColorStop(.35, "rgba(0,0,0,.35)"); gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Contact shadows and corner occlusion that ground the photographed book. Real photographs always show a
 * dark seam where an object meets the floor and a soft darkening behind it on the wall; a shadow map alone
 * is too sharp and too faint to give that.
 */
export function createPhotoGrounding(scene: THREE.Scene, floorY: number, wallZ: number) {
  const contact = softRectTexture(18), soft = softRectTexture(44), fade = fadeTexture();
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
  const footprint = make(decal(contact, .62), true), spread = make(decal(soft, .3), true);
  const behind = make(decal(soft, .26), false);
  const cornerFloor = make(decal(fade, .16), true), cornerWall = make(decal(fade, .12), false);
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
        footprint.scale.set(width * 1.03, length * 1.03, 1);
        footprint.position.set(cx, floorY + .0008, cz);
        spread.scale.set(width * 1.22, length * 1.2, 1);
        spread.position.set(cx + .015, floorY + .0007, cz + .02);
        return;
      }
      footprint.scale.set(width * 1.04, depth + .05, 1);
      footprint.position.set(cx, floorY + .0008, bounds.max.z - depth / 2 - .005);
      spread.scale.set(width * 1.3, depth + .5, 1);
      spread.position.set(cx, floorY + .0007, bounds.max.z - depth / 2 - .06);
      behind.scale.set(width * 1.1, height * 1.08, 1);
      behind.position.set(cx + width * .02, floorY + height * .52, wallZ + .0008);
    },
    dispose() {
      for (const mesh of [footprint, spread, behind, cornerFloor, cornerWall]) { scene.remove(mesh); (mesh.material as THREE.Material).dispose(); }
      plane.dispose(); contact.dispose(); soft.dispose(); fade.dispose();
    },
  };
}
