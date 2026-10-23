/** The shapes a page tab can take. Every one is cut from the tab picture, tucked end on the left, outer end right. */
export const TAB_STYLES = [
  { id: "rounded", label: "Rounded", description: "A soft rounded end." },
  { id: "pill", label: "Pill", description: "Fully round, like a pebble." },
  { id: "square", label: "Square", description: "Crisp, with barely softened corners." },
  { id: "angled", label: "Angled", description: "Bevelled ends, like a classic index tab." },
  { id: "ribbon", label: "Ribbon", description: "A notched end, like a fabric marker." },
] as const;
export type TabStyle = (typeof TAB_STYLES)[number]["id"];
export const readableTabStyle = (value: unknown): TabStyle => (TAB_STYLES.some((s) => s.id === value) ? (value as TabStyle) : "rounded");

type Path = Pick<CanvasRenderingContext2D, "beginPath" | "moveTo" | "lineTo" | "arcTo" | "closePath">;

/** Traces the tab's outline (width runs from the tucked end to the outer end, height along the page edge). */
export function tabOutline(ctx: Path, style: TabStyle, width: number, height: number) {
  const w = width, h = height;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (style === "angled") {
    const bevel = Math.min(h * 0.16, w * 0.5), r = Math.min(w, h) * 0.06;
    ctx.lineTo(w - r, bevel);
    ctx.arcTo(w, bevel + r * 0.4, w, bevel + r, r);
    ctx.lineTo(w, h - bevel - r);
    ctx.arcTo(w, h - bevel - r * 0.4, w - r, h - bevel, r);
    ctx.lineTo(0, h);
  } else if (style === "ribbon") {
    const notch = w * 0.24;
    ctx.lineTo(w, 0);
    ctx.lineTo(w - notch, h / 2);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
  } else {
    const r = style === "pill" ? Math.min(w * 0.95, h * 0.5) : style === "square" ? Math.min(w, h) * 0.08 : Math.min(w * 0.42, h * 0.5);
    ctx.lineTo(w - r, 0);
    ctx.arcTo(w, 0, w, r, r);
    ctx.lineTo(w, h - r);
    ctx.arcTo(w, h, w - r, h, r);
    ctx.lineTo(0, h);
  }
  ctx.closePath();
}
