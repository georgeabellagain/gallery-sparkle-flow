import * as THREE from "three";
import { spreadIndex, type Leaf, type Spread } from "./book-layout";

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

/**
 * Headband silk: the ribbon colour with a soft, fine ribbing (a slightly lighter thread every other row, blended),
 * so at reading size it reads as woven silk rather than hard stripes.
 */
export function headbandTexture(colour: string) {
  // A tiny data texture rather than a canvas, so it also works where there is no DOM (tests, workers).
  const shade = new THREE.Color(colour), thread = shade.clone().lerp(new THREE.Color("#ffffff"), .16), data = new Uint8Array(2 * 4);
  [shade, thread].forEach((c, i) => data.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4));
  const texture = new THREE.DataTexture(data, 1, 2); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1, 14); texture.needsUpdate = true;
  return texture;
}

/**
 * Where the ribbon is for the pages showing. `mark` is the gutter of the marked spread and `left`/`right` the
 * leaves resting either side (a gutter is the number of leaves to its left). While a sheet turns, the resting
 * pages straddle it, so the ribbon is never on an open page then. Omitted mark keeps the plain table tail.
 */
export type RibbonPlacement = { mode: "default" } | { mode: "open" } | { mode: "tail"; side: -1 | 1; depth: number };
export function ribbonPlacement(mark: number | undefined, left: number | undefined, right: number | undefined, leaves: number): RibbonPlacement {
  if (mark === undefined || !Number.isFinite(mark) || (left === undefined && right === undefined)) return { mode: "default" };
  const low = left !== undefined ? left + 1 : 0, high = right !== undefined ? right : Math.max(low, leaves);
  if (left !== undefined && right !== undefined && low === high && mark === low) return { mode: "open" };
  // A closed book holds the ribbon in its only block.
  if (right === undefined) return { mode: "tail", side: -1, depth: THREE.MathUtils.clamp((low - mark) / Math.max(1, low), 0, 1) };
  if (left === undefined || mark >= high) return { mode: "tail", side: 1, depth: THREE.MathUtils.clamp((mark - high) / Math.max(1, leaves - high), 0, 1) };
  if (mark <= low) return { mode: "tail", side: -1, depth: THREE.MathUtils.clamp((low - mark) / Math.max(1, low), 0, 1) };
  return { mode: "tail", side: -1, depth: 0 };
}
/** The gutter of the spread showing PDF page `page`, for `ribbonPlacement`; undefined when no page is marked. */
export function ribbonGutterFor(page: unknown, layout: { leaves: readonly Leaf[]; spreads: readonly Spread[] }) {
  if (typeof page !== "number" || !Number.isInteger(page)) return undefined;
  const leaf = layout.leaves.findIndex(l => l.page === page);
  if (leaf < 0) return undefined;
  // A ribbon can only lie in an open book: marking a cover marks the first (or last) open spread beside it.
  let index = spreadIndex(layout.spreads as Spread[], leaf);
  const open = (i: number) => layout.spreads[i]?.[0] != null && layout.spreads[i]?.[1] != null;
  if (!open(index)) index = open(index + 1) ? index + 1 : open(index - 1) ? index - 1 : index;
  return spreadGutter(layout.spreads[index] ?? [null, leaf]);
}
/** The PDF page whose spread the photo shoot treats as marked: a cover page marks the open spread beside it. */
export function ribbonSpreadPage(page: number | undefined, pages: number) {
  if (page === undefined || pages < 2) return page;
  if (page === 1) return 2;
  return page === pages && pages % 2 === 0 ? pages - 1 : page;
}
/** The gutter of the spread holding `leaf`: the right leaf's index, or one past a lone left leaf. */
export function spreadGutter(spread: readonly [number | null, number | null]) {
  return spread[1] ?? (spread[0] ?? -1) + 1;
}

export type RibbonShape = {
  /** Thickness of the silk; the edges round over between the faces. */
  thickness?: number;
  /** Largest twist (radians) where the ribbon hangs free. */
  twist?: number;
  /** Depth of the V cut into the free end, as a share of the width. */
  notch?: number;
  /** How much each point rests on a surface (0 hanging, 1 lying flat); flat parts never twist and cast the contact shadow. */
  contact?: readonly number[];
};
const contactAt = (contact: readonly number[] | undefined, t: number) => {
  if (!contact?.length) return 1;
  const x = t * (contact.length - 1), i = Math.min(contact.length - 2, Math.floor(x));
  return contact.length === 1 ? contact[0]! : THREE.MathUtils.lerp(contact[i]!, contact[i + 1]!, x - i);
};
/** Centre, across and face directions of the ribbon along `points`, shared by the silk and its shadow. */
/** One face direction, or one per point (blended between them) for a ribbon that runs over differently facing surfaces. */
export type RibbonFacing = THREE.Vector3 | readonly THREE.Vector3[];
const facingAt = (facing: RibbonFacing, t: number, out: THREE.Vector3) => {
  if (facing instanceof THREE.Vector3) return out.copy(facing);
  const x = t * (facing.length - 1), i = Math.min(facing.length - 2, Math.floor(x));
  return facing.length === 1 ? out.copy(facing[0]!) : out.lerpVectors(facing[i]!, facing[i + 1]!, x - i).normalize();
};
function ribbonFrames(points: readonly THREE.Vector3[], width: number, facing: RibbonFacing, segments: number, shape: RibbonShape) {
  const face = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.clone()), false, "centripetal");
  const frames: { point: THREE.Vector3; side: THREE.Vector3; normal: THREE.Vector3; tangent: THREE.Vector3; t: number; contact: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    // Per-point values belong to the control points, which are not evenly spaced along the ribbon.
    const along = curve.getUtoTmapping(t, 0);
    const side = new THREE.Vector3().crossVectors(tangent, facingAt(facing, along, face));
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize();
    const contact = contactAt(shape.contact, along);
    // Free silk turns a little about its length, most in the middle of the drop.
    side.applyAxisAngle(tangent, (shape.twist ?? 0) * (1 - contact) ** 2 * Math.sin(Math.PI * t));
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();
    frames.push({ point, side: side.multiplyScalar(width / 2), normal, tangent, t, contact });
  }
  return frames;
}
/**
 * A satin ribbon following `points`, `width` wide, its face turned towards `facing` where it can: two faces
 * `thickness` apart whose shared edges round over (smoothed normals), a gentle twist where it hangs and a V
 * cut into the free end. Rebuilds into `geometry` when given, so the shape can change without new allocations.
 */
export function ribbonGeometry(points: readonly THREE.Vector3[], width: number, facing: RibbonFacing, geometry?: THREE.BufferGeometry, segments = 40, shape: RibbonShape = {}) {
  const thickness = shape.thickness ?? .0008, notch = (shape.notch ?? .55) * width;
  const frames = ribbonFrames(points, width, facing, segments, { twist: .5, ...shape });
  // Each row: three points across the top face, then the same three on the bottom face.
  const positions = new Float32Array((segments + 1) * 6 * 3), uvs = new Float32Array((segments + 1) * 6 * 2);
  frames.forEach(({ point, side, normal, tangent, t }, i) => {
    const last = i === segments;
    for (let face = 0; face < 2; face++) {
      const lift = (face === 0 ? .5 : -.5) * thickness;
      for (let k = 0; k < 3; k++) {
        const across = k - 1, back = last && k === 1 ? -notch : 0;
        const o = (i * 6 + face * 3 + k) * 3;
        positions[o] = point.x + side.x * across + normal.x * lift + tangent.x * back;
        positions[o + 1] = point.y + side.y * across + normal.y * lift + tangent.y * back;
        positions[o + 2] = point.z + side.z * across + normal.z * lift + tangent.z * back;
        uvs.set([k / 2, t], (i * 6 + face * 3 + k) * 2);
      }
    }
  });
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => index.push(a, b, c, b, d, c);
  for (let i = 0; i < segments; i++) {
    const a = i * 6, b = a + 6;
    quad(a, a + 1, b, b + 1); quad(a + 1, a + 2, b + 1, b + 2);
    quad(a + 4, a + 3, b + 4, b + 3); quad(a + 5, a + 4, b + 5, b + 4);
    // The two long edges join the faces; sharing their points rounds the edge in the shading.
    quad(a + 3, a, b + 3, b); quad(a + 2, a + 5, b + 2, b + 5);
  }
  const output = geometry ?? new THREE.BufferGeometry();
  output.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  output.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  // Bounds are recomputed too: a rebuilt ribbon must never be culled or framed using its previous shape.
  output.setIndex(index); output.computeVertexNormals(); output.computeBoundingSphere(); output.computeBoundingBox();
  return output;
}
/** The soft dark band under the ribbon where it rests on paper or the table; vertex alpha fades it to nothing at its edges. */
export function ribbonShadowGeometry(points: readonly THREE.Vector3[], width: number, facing: RibbonFacing, geometry?: THREE.BufferGeometry, segments = 40, shape: RibbonShape = {}) {
  const frames = ribbonFrames(points, width, facing, segments, { ...shape, twist: 0 });
  const positions = new Float32Array((segments + 1) * 3 * 3), colours = new Float32Array((segments + 1) * 3 * 4);
  frames.forEach(({ point, side, normal, contact, t }, i) => {
    const strength = contact * contact * Math.min(1, (1 - t) * 12);
    for (let k = 0; k < 3; k++) {
      const across = (k - 1) * 1.9, o = (i * 3 + k) * 3;
      positions[o] = point.x + side.x * across - normal.x * .0003 + side.x * .15;
      positions[o + 1] = point.y + side.y * across - normal.y * .0003 + side.y * .15;
      positions[o + 2] = point.z + side.z * across - normal.z * .0003 + side.z * .15;
      colours.set([0, 0, 0, k === 1 ? strength : 0], (i * 3 + k) * 4);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < segments; i++) { const a = i * 3, b = a + 3; index.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); }
  const output = geometry ?? new THREE.BufferGeometry();
  output.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  output.setAttribute("color", new THREE.BufferAttribute(colours, 4));
  output.setIndex(index); output.computeBoundingSphere(); output.computeBoundingBox();
  return output;
}
/** Satin ribbon material: a soft fabric sheen over a slightly glossy base, two-sided so it reads from either face. */
export function ribbonMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: DEFAULT_RIBBON_COLOUR, roughness: .42, metalness: 0, sheen: .8, sheenRoughness: .32, sheenColor: new THREE.Color("#ffffff"), side: THREE.DoubleSide });
}
export function ribbonShadowMaterial(opacity = .38) {
  return new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}
