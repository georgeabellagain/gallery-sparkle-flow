/** Shape is independent of motion timing and the selected paper finish. */
export const TURN_CURVES = [
  { id: "classic", label: "Classic", description: "The original natural page bend." },
  { id: "firm", label: "Firm sheet", description: "A flatter, stiffer sheet with a subtle bend." },
  { id: "deep", label: "Deep curl", description: "A fuller curl through the middle of the page." },
  { id: "corner", label: "Corner lift", description: "The lower outside corner leads a diagonal turn." },
] as const;
export type TurnCurve = typeof TURN_CURVES[number]["id"];
export function readableTurnCurve(value: unknown): TurnCurve {
  return value === "firm" || value === "deep" || value === "corner" ? value : "classic";
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
