import type { ViewerSettings } from "./store";

/** The colour each of the original background choices stands for. */
export const PRESET_COLOURS: Record<string, string> = {
  midnight: "#191d3a",
  black: "#111111",
  paper: "#ffffff",
  soft: "#f1f1ef",
  oak: "#191d3a",
  walnut: "#191d3a",
};
export const DEFAULT_BACKGROUND = "#191d3a";

export type BackgroundFit = { scale: number; x: number; y: number };
export const DEFAULT_FIT: BackgroundFit = { scale: 1, x: 0, y: 0 };

/**
 * The colour behind the PDF: the colour-wheel choice first, then the older
 * "behind the PDF" colour some Personal portfolios already have, then the preset.
 */
export function backgroundColour(view: Pick<ViewerSettings, "background" | "backgroundColor">, styleBackdrop?: string): string {
  return view.backgroundColor || styleBackdrop || PRESET_COLOURS[view.background] || DEFAULT_BACKGROUND;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Whether a hex colour is light or dark, so the controls on top of it stay readable. */
export function toneOfHex(hex: string): "light" | "dark" {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "dark";
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const channel = (at: number) => {
    const v = parseInt(h.slice(at, at + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // About 0.18 is where black and white are equally easy to read; above it, dark icons are clearer.
  return luminance > 0.18 ? "light" : "dark";
}

/**
 * CSS transform for a background picture. The picture always covers its area; it
 * can be enlarged and then moved, but never far enough to show an edge.
 */
export function fitTransform(fit?: Partial<BackgroundFit>): string {
  const scale = clamp(fit?.scale ?? 1, 1, 3);
  const room = 50 * (scale - 1);
  const x = clamp(fit?.x ?? 0, -1, 1) * room;
  const y = clamp(fit?.y ?? 0, -1, 1) * room;
  return `translate(${x}%, ${y}%) scale(${scale})`;
}
