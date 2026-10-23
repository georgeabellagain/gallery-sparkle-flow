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
/** The steepest the fold may tilt, up or down, at the start of a pointer turn. */
export const FOLD_MAX_TILT = (30 * Math.PI) / 180;
/**
 * Hard stops for a pointer turn. The page follows the pointer's horizontal travel exactly; how far it may be pulled
 * up or down is limited to a tilt of FOLD_MAX_TILT, narrowing to level as the page goes over, and never so steep
 * that the fold line would reach the spine anywhere on the page. It is a smooth function of the pointer, so the
 * page never jumps or twitches, however far the pointer goes.
 */
export function constrainFoldPointer(grabY: number, pointer: FoldPoint, ratio: number): FoldPoint {
  const px = Math.max(-1, Math.min(1, Number.isFinite(pointer.x) ? pointer.x : 1));
  const dx = 1 - px, progress = pointerFoldProgress({ x: px, y: grabY });
  if (dx < 1e-6) return { x: px, y: grabY };
  // Tilt allowed by the stop, easing to level as the page lands.
  const ease = 1 - progress * progress * (3 - 2 * progress);
  let tanMax = Math.tan(FOLD_MAX_TILT) * ease;
  // And by the spine: the fold line, from its middle, may lean at most until it touches x = 0 at the page's far edge.
  const radius = 0.085 * Math.pow(Math.sin(Math.PI * progress), 0.7);
  const middle = (1 + px) / 2 - Math.min(Math.PI * radius, dx) / 2;
  const reach = Math.max(grabY, ratio - grabY) + 1e-6;
  tanMax = Math.max(0, Math.min(tanMax, (middle * 0.95) / reach));
  // The pointer's own tilt, held within the stops.
  const wanted = (grabY - (Number.isFinite(pointer.y) ? pointer.y : grabY)) / dx;
  const tilt = Math.max(-tanMax, Math.min(tanMax, wanted));
  return { x: px, y: grabY - dx * tilt };
}
export function pointerFold(x: number, y: number, grabY: number, pointer: FoldPoint): { x: number; y: number; z: number } {
  const line = foldLine(grabY, pointer);
  if (!line) return { x, y, z: 0 };
  const { nx, ny, mx, my, radius } = line;
  // Distance past the fold line, towards the grabbed point. The spine side stays where it is.
  const s = (x - mx) * nx + (y - my) * ny;
  // The spine is the hinge and never moves; points within a millionth of the fold count as unfolded.
  if (s <= 1e-6 || x <= 1e-9) return { x, y, z: 0 };
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
