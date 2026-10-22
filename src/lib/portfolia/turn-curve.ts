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
