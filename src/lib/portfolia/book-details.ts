import * as THREE from "three";

/** Silk ribbon colours offered to creators; the first is the default. */
export const RIBBON_COLOURS = ["#8c1d2c", "#1f3a5f", "#2f5d3a", "#c9a227", "#1c1c1c", "#efe9dc"] as const;
export const DEFAULT_RIBBON_COLOUR = RIBBON_COLOURS[0];
export function readableRibbonColour(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_RIBBON_COLOUR;
}
/** Which book styles carry each detail. Loose flipbook sheets have no binding to hold them. */
export const hasHeadbands = (style: unknown) => style === "hardback";
export const hasRibbon = (style: unknown, ribbon: unknown) => ribbon === true && (style === "hardback" || style === "softcover");

let cloth: { normal: THREE.DataTexture; roughness: THREE.DataTexture } | undefined;
/**
 * A woven book-cloth surface: over/under warp and weft threads with slight irregularity, as a tiling
 * normal map and roughness map. Generated once and shared by every renderer on the page.
 */
export function clothTextures() {
  if (cloth) return cloth;
  const size = 256, threads = 32, cell = size / threads, height = new Float32Array(size * size);
  let seed = 917; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const jitter = Float32Array.from({ length: threads * 2 }, () => .75 + random() * .5);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), fx = (x % cell) / cell, fy = (y % cell) / cell;
    // Warp runs vertically, weft horizontally; they swap over in a plain weave.
    const warpOnTop = (cx + cy) % 2 === 0;
    const warp = Math.sin(Math.PI * fx) * jitter[cx]!, weft = Math.sin(Math.PI * fy) * jitter[threads + cy]!;
    height[y * size + x] = (warpOnTop ? warp * (.6 + .4 * Math.sin(Math.PI * fy)) : weft * (.6 + .4 * Math.sin(Math.PI * fx))) + random() * .08;
  }
  const normal = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 1.6, dy = (at(x, y + 1) - at(x, y - 1)) * 1.6;
    const length = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    normal.set([(-dx / length * .5 + .5) * 255, (-dy / length * .5 + .5) * 255, (1 / length * .5 + .5) * 255, 255], i);
    const r = 205 + (1 - at(x, y)) * 40; rough.set([r, r, r, 255], i);
  }
  const texture = (data: Uint8Array) => {
    const t = new THREE.DataTexture(data, size, size);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  cloth = { normal: texture(normal), roughness: texture(rough) };
  return cloth;
}
/**
 * Gives a board material the cloth surface at a consistent thread density for a face `width` × `height`
 * book units. Clones share the bitmap (one GPU upload) but keep their own repeat. Returns the clones so
 * the owner can dispose of them; calling again only updates the repeat.
 */
export function applyCloth(material: THREE.MeshStandardMaterial, width: number, height: number) {
  const { normal, roughness } = clothTextures();
  let maps = material.userData["cloth"] as [THREE.Texture, THREE.Texture] | undefined;
  if (!maps) {
    maps = [normal.clone(), roughness.clone()];
    material.userData["cloth"] = maps;
    material.normalMap = maps[0]; material.roughnessMap = maps[1];
    material.normalScale.set(.55, .55); material.roughness = 1; material.needsUpdate = true;
  }
  for (const map of maps) map.repeat.set(width * 9, height * 9);
  return maps;
}
export function disposeCloth(material: THREE.MeshStandardMaterial) {
  (material.userData["cloth"] as THREE.Texture[] | undefined)?.forEach(map => map.dispose());
}

/** Striped silk headband texture, the colour alternating with cream. */
export function headbandTexture(colour: string) {
  // A tiny data texture rather than a canvas, so it also works where there is no DOM (tests, workers).
  const shade = new THREE.Color(colour), cream = new THREE.Color("#efe7d2"), data = new Uint8Array(2 * 4);
  [shade, cream].forEach((c, i) => data.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4));
  const texture = new THREE.DataTexture(data, 1, 2); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1, 6); texture.needsUpdate = true;
  return texture;
}

/**
 * A flat ribbon following `points`, `width` wide, its face turned towards `facing` where it can.
 * Rebuilds into `geometry` when given, so the shape can change without new allocations each time.
 */
export function ribbonGeometry(points: readonly THREE.Vector3[], width: number, facing: THREE.Vector3, geometry?: THREE.BufferGeometry, segments = 40) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.clone()), false, "centripetal");
  const positions = new Float32Array((segments + 1) * 2 * 3), uvs = new Float32Array((segments + 1) * 2 * 2);
  const side = new THREE.Vector3(), tangent = new THREE.Vector3(), point = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, point); curve.getTangentAt(t, tangent);
    side.crossVectors(tangent, facing);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize().multiplyScalar(width / 2);
    positions.set([point.x - side.x, point.y - side.y, point.z - side.z, point.x + side.x, point.y + side.y, point.z + side.z], i * 6);
    uvs.set([0, t, 1, t], i * 4);
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const output = geometry ?? new THREE.BufferGeometry();
  output.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  output.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  // Bounds are recomputed too: a rebuilt ribbon must never be culled or framed using its previous shape.
  output.setIndex(index); output.computeVertexNormals(); output.computeBoundingSphere(); output.computeBoundingBox();
  return output;
}
/** Satin ribbon material: slightly glossy, two-sided so it reads from either face. */
export function ribbonMaterial() {
  return new THREE.MeshStandardMaterial({ color: DEFAULT_RIBBON_COLOUR, roughness: .38, metalness: 0, side: THREE.DoubleSide });
}
