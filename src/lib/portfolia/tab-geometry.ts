/** Where a page tab sits and how it moves with the sheet it is attached to. Pure numbers, so it can be tested alone. */
export type TabEdge = "left" | "right";
export interface TabPlan {
  id: string;
  /** Edge the tab rests on before the turn, and after it. */
  from: TabEdge;
  to: TabEdge;
  /** True when the tab is on the sheet that is turning, so it travels with that sheet. */
  sheet: boolean;
}
/** How far a tab sticks out of the page edge and how far it tucks under it, in page widths. */
export const TAB_SIZE = {
  full: { out: 0.075, in: 0.004 },
  compact: { out: 0.036, in: 0.004 },
};
/** How strongly a turning sheet bows (matches the sheet in book-scene). */
export const SHEET_CURL = 0.22;
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
/** Evenly spaced slots down the edge, in page order, centred on the page. Slot 0 is at the top. */
export function tabSlot(ratio: number, index: number, count: number) {
  const usable = ratio * 0.9;
  const gap = 0.012;
  const height = Math.min(ratio * 0.16, (usable - gap * (count - 1)) / Math.max(1, count));
  const total = count * height + (count - 1) * gap;
  return { y: total / 2 - height / 2 - index * (height + gap), height };
}
/**
 * The outer edge of the turning sheet at progress 0..1 (0 flat on the right, 1 flat on the left when `dir` is 1),
 * with the direction pointing outward along the sheet. `v` is how far up the page the point is (0 bottom, 1 top).
 */
export function sheetEdge(progress: number, dir: 1 | -1, v: number) {
  const a = Math.PI * progress;
  const f = 1 + 0.35 * (0.5 - v);
  const dx = dir * (Math.cos(a) - SHEET_CURL * Math.PI * Math.sin(a) ** 2 * f);
  const dz = Math.sin(a) + SHEET_CURL * Math.PI * Math.sin(a) * Math.cos(a) * f;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dir * Math.cos(a), z: Math.sin(a), tx: dx / length, tz: dz / length };
}
/** The frame a tab hangs from: its sheet's edge while that sheet turns, otherwise the edge it rests on. */
export function tabFrame(plan: Pick<TabPlan, "from" | "to" | "sheet">, progress: number, dir: 1 | -1, v: number) {
  if (plan.sheet) return sheetEdge(progress, dir, v);
  const edge = progress < 0.5 ? plan.from : plan.to;
  return sheetEdge(edge === "right" ? 0 : 1, 1, v);
}
/** Whether the tab is lying close to the page (so it should take the page's curve) or lifted away. */
export const nearPage = (height: number) => 1 - smooth(Math.max(0, height) / 0.08);
/**
 * Which edge a tab sticks out of, like the tabs of a real book: tabs for pages ahead stick out of the right edge,
 * tabs for pages already passed out of the left, and a tab for a page on show stays on its own page's edge.
 * A phone shows one page, so everything sits on the right.
 */
export function tabEdge(leaf: number, spread: Array<number | null>, narrow: boolean): TabEdge {
  if (narrow) return "right";
  const shown = spread.filter((n): n is number => n !== null);
  if (shown.includes(leaf)) return spread[0] === leaf ? "left" : "right";
  return leaf < Math.min(...shown) ? "left" : "right";
}
/** Where each tab is during a turn, from the spread before and after it and the sheet's two leaves. */
export function planTabs(
  tabs: Array<{ id: string; leaf: number }>,
  from: Array<number | null>,
  to: Array<number | null>,
  sheetLeaves: Array<number | null>,
  narrow: boolean,
): TabPlan[] {
  return tabs.map((t) => ({
    id: t.id,
    from: tabEdge(t.leaf, from, narrow),
    to: tabEdge(t.leaf, to, narrow),
    sheet: !narrow && sheetLeaves.includes(t.leaf),
  }));
}
