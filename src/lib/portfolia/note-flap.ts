import * as THREE from "three";

/** How far a note's paper sits above the page, and a flap above that, so the layers never fight. */
export const NOTE_LIFT = 0.022;
export const FLAP_LIFT = 0.001;
/** The two faces of the flap are held this far either side of the sheet, so they never z-fight. */
export const PAPER_GAP = 0.0005;
export const FLAP_SEGMENTS = 16;
export const FLAP_ACROSS = 8;

export interface FlapGrid {
  /** Distance from the hinge, as a fraction of the flap's length (0 at the hinge). */
  a: number[];
  /** Position across the hinge, -0.5..0.5. */
  c: number[];
  index: number[];
}
export function flapGrid(segments: number, across: number): FlapGrid {
  const a: number[] = [],
    c: number[] = [],
    index: number[] = [];
  for (let j = 0; j <= across; j++)
    for (let i = 0; i <= segments; i++) {
      a.push(i / segments);
      c.push(j / across - 0.5);
    }
  const row = segments + 1;
  for (let j = 0; j < across; j++)
    for (let i = 0; i < segments; i++) {
      const p = j * row + i;
      index.push(p, p + 1, p + row, p + 1, p + row + 1, p + row);
    }
  return { a, c, index };
}
/**
 * One face of the flap. Positions are filled in every frame by `flapShape`. The texture covers the closed
 * note exactly; the back face reads from behind, so its coordinates run the other way along the swing.
 */
export function flapGeometry(grid: FlapGrid, vertical: boolean, e: number, back: boolean) {
  const geometry = new THREE.BufferGeometry();
  const uv: number[] = [];
  for (let i = 0; i < grid.a.length; i++) {
    // Where this point rests on the closed note, 0..1 along the swing axis.
    let along = e === 1 ? grid.a[i]! : 1 - grid.a[i]!;
    const across = grid.c[i]! + 0.5;
    if (back) along = 1 - along;
    uv.push(...(vertical ? [across, along] : [along, across]));
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(grid.a.length * 3), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  // The grid is wound for a swing that runs in +x; mirrored swings reverse it so the front still faces the viewer.
  const flip = vertical ? e === 1 : e === -1;
  const index = flip
    ? grid.index.map((_, i, all) => all[i - (i % 3) + (2 - (i % 3))]!)
    : grid.index;
  geometry.setIndex(index);
  return geometry;
}
export interface FlapPoint {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
/**
 * Where every point of the flap is at progress `p` (0 closed, 1 fully open), relative to the note's centre.
 * The sheet turns about its hinge, its free end trails the motion so it bends, and near the page it settles
 * onto the page's curve (`reliefAt` takes a position in the book).
 */
export function flapShape(
  geo: {
    along: number;
    across: number;
    /** Direction from the hinge into the flap along the swing axis. */
    e: number;
    /** The hinge's position along the swing axis, from the note's centre. */
    hinge: number;
    vertical: boolean;
    centre: { x: number; y: number };
  },
  grid: FlapGrid,
  p: number,
  reliefAt: (x: number, y: number) => number,
): FlapPoint[] {
  const theta = Math.PI * p;
  const cos = Math.cos(theta),
    sin = Math.sin(theta);
  const out: FlapPoint[] = [];
  // The normal of the front face at this angle, in (swing axis, z).
  const nAxis = -geo.e * sin,
    nZ = cos;
  for (let i = 0; i < grid.a.length; i++) {
    const t = grid.a[i]!;
    const a = t * geo.along;
    const c = grid.c[i]! * geo.across;
    // Free end trails the swing; the edges lag a little behind the middle.
    const trail = -0.2 * geo.along * sin * Math.pow(t, 1.6);
    const edge = 0.045 * geo.across * sin * t * (1 - Math.pow(2 * grid.c[i]!, 2));
    const bend = trail + edge;
    const axis = geo.hinge + geo.e * a * cos + bend * nAxis;
    const rigidZ = a * sin;
    let z = rigidZ + bend * nZ;
    const x = geo.vertical ? c : axis,
      y = geo.vertical ? axis : c;
    // Close to the page the sheet takes the page's shape; high above it, none.
    z += reliefAt(geo.centre.x + x, geo.centre.y + y) * (1 - smooth(Math.max(0, rigidZ) / 0.08));
    out.push({
      x,
      y,
      z,
      nx: geo.vertical ? 0 : nAxis,
      ny: geo.vertical ? nAxis : 0,
      nz: nZ,
    });
  }
  return out;
}
