/** Shape is independent of motion timing and the selected paper finish. */
export const TURN_CURVES = [
  { id: "classic", label: "Classic", description: "The original natural page bend." },
  { id: "firm", label: "Firm sheet", description: "A flatter, stiffer sheet with a subtle bend." },
  { id: "deep", label: "Deep curl", description: "A fuller curl through the middle of the page." },
  { id: "corner", label: "Corner lift", description: "The lower outside corner leads a diagonal turn." },
  { id: "soft", label: "Soft fold", description: "A very soft sheet that rolls over close to the paper, like a magazine page." },
] as const;
export type TurnCurve = typeof TURN_CURVES[number]["id"];
export function readableTurnCurve(value: unknown): TurnCurve {
  return value === "firm" || value === "deep" || value === "corner" || value === "soft" ? value : "classic";
}

/**
 * Soft fold: the sheet rolls over a small cylinder that travels from the outer edge to the spine, so it stays
 * close to the paper instead of swinging upright. u is the distance from the spine (0..1), v the height (0..1).
 * Returns the position across the spread (positive = still on the starting side) and the height above it.
 * The spine edge never moves, and both resting poses are exactly flat (radius and travel reach zero).
 */
export function softFold(u: number, v: number, progress: number): { x: number; z: number } {
  const p = Math.max(0, Math.min(1, progress)), wave = Math.sin(Math.PI * p);
  // The roll is fuller near the pulled bottom corner and tighter at the head, so the turned flap isn't one flat slab.
  const radius = .085 * Math.pow(wave, .7) * (.85 + .3 * (1 - v));
  // The lower outside corner leads, as when a reader pulls the page from the bottom corner. A soft sheet doesn't
  // fold along a ruler: the middle trails behind that diagonal, and a faint ripple travels up the fold as it turns,
  // so the turning edge bows and moves like paper.
  const lead = .14 * (.5 - v), bow = .05 * Math.sin(Math.PI * v), ripple = .012 * Math.sin(2 * Math.PI * v + 1.5 * Math.PI * p);
  const fold = Math.max(0, 1 - p - (lead - bow + ripple) * wave);
  const s = u - fold;
  if (s <= 0 || radius < 1e-5) return s <= 0 ? { x: u, z: 0 } : { x: 2 * fold - u, z: 0 };
  const wrap = Math.PI * radius;
  if (s < wrap) { const angle = s / radius; return { x: fold + radius * Math.sin(angle), z: radius * (1 - Math.cos(angle)) }; }
  return { x: fold - (s - wrap), z: 2 * radius };
}
/**
 * Soft fold under the reader's pointer, as competitors' page turns behave. The point grabbed on the outer edge,
 * (1, grabY), follows the pointer; the paper folds along the line halfway between them, at right angles to the
 * line joining them, rolling over a small cylinder there. Coordinates are page units: x from the spine (0) to the
 * outer edge (1), y from the foot (0) up to `ratio`. Pure numbers.
 */
export type FoldPoint = { x: number; y: number };
/** How far a pointer turn has got: 0 with the grabbed point at home, 1 once it lies on the far side. */
export const pointerFoldProgress = (p: FoldPoint) => Math.max(0, Math.min(1, (1 - p.x) / 2));
/**
 * The fold for a pointer at `pointer`: its direction (towards the grabbed point), a point on it, and the roll's
 * radius. The line sits half a roll nearer the pointer than halfway, because the roll itself uses up paper; that
 * way the grabbed point lands exactly under the pointer.
 */
function foldLine(grabY: number, pointer: FoldPoint) {
  const nx0 = 1 - pointer.x, ny0 = grabY - pointer.y, length = Math.hypot(nx0, ny0);
  if (length < 1e-5) return null;
  const nx = nx0 / length, ny = ny0 / length;
  const radius = 0.085 * Math.pow(Math.sin(Math.PI * pointerFoldProgress(pointer)), 0.7), wrap = Math.PI * radius;
  const shift = Math.min(wrap, length) / 2;
  return { nx, ny, mx: (1 + pointer.x) / 2 - nx * shift, my: (grabY + pointer.y) / 2 - ny * shift, radius, wrap };
}
/** Keeps the pointer where paper bound at the spine could actually reach, so the fold never crosses the spine. */
export function constrainFoldPointer(grabY: number, pointer: FoldPoint, ratio: number): FoldPoint {
  let px = Math.max(-1, Math.min(1, pointer.x)), py = Math.max(-ratio * 0.25, Math.min(ratio * 1.25, pointer.y));
  // The grabbed point stays within a page width of the spine at its own height.
  const dy0 = py - grabY, d = Math.hypot(px, dy0);
  if (d > 1) { px /= d; py = grabY + dy0 / d; }
  // Steep folds are eased back towards level until the fold line stays on the page side of the spine.
  for (let i = 0; i < 24; i++) {
    const line = foldLine(grabY, { x: px, y: py });
    if (!line || line.nx < 1e-6) break;
    const xAt = (y: number) => line.mx - ((y - line.my) * line.ny) / line.nx;
    if (Math.min(xAt(0), xAt(ratio)) >= 0) break;
    py = grabY + (py - grabY) * 0.75;
    if (Math.abs(py - grabY) < 1e-4) { px = Math.max(px, -1); break; }
  }
  return { x: px, y: py };
}
export function pointerFold(x: number, y: number, grabY: number, pointer: FoldPoint): { x: number; y: number; z: number } {
  const line = foldLine(grabY, pointer);
  if (!line) return { x, y, z: 0 };
  const { nx, ny, mx, my, radius } = line;
  // Distance past the fold line, towards the grabbed point. The spine side stays where it is.
  const s = (x - mx) * nx + (y - my) * ny;
  if (s <= 0) return { x, y, z: 0 };
  if (radius < 1e-5) return { x: x - 2 * s * nx, y: y - 2 * s * ny, z: 0 };
  const wrap = line.wrap;
  if (s < wrap) {
    const a = s / radius, back = s - radius * Math.sin(a);
    return { x: x - nx * back, y: y - ny * back, z: radius * (1 - Math.cos(a)) };
  }
  const back = 2 * s - wrap;
  return { x: x - nx * back, y: y - ny * back, z: 2 * radius };
}
export function turnCurl(curve: TurnCurve, u: number, v: number) {
  const arch = Math.sin(Math.PI*u);
  if (curve === "firm") return .08*arch;
  if (curve === "deep") return .25*arch*arch*(1+.2*(.5-v));
  if (curve === "corner") return .25*arch*(.7+.9*(1-v)*(1-v));
  return .30*arch*(1+.35*(.5-v));
}
/** A smooth twist vanishes at both resting poses and remains anchored at the spine. */
export function turnCornerLead(curve: TurnCurve, u: number, v: number) {
  return curve === "corner" ? .4*u*u*(1-v)*(1-v) : 0;
}

/** Paper bends progressively, peaks near mid-turn, then relaxes into its landing. */
export function deepTurnCurl(u:number,v:number,progress:number){
  const p=Math.max(0,Math.min(1,progress)),wave=Math.sin(Math.PI*p);
  return .25*Math.sin(Math.PI*u)**(1.6+.8*p)*(1+.12*(.5-v))*(.45+.55*wave);
}
