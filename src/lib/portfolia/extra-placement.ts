import { extraWidth, transformExtra, type Extra, type ExtraKind } from "./scrapbook-transform";
import { hotspotHeight, videoHeight, type PageHotspot, type PageVideo } from "./page-extras";
export function extraBox(kind: ExtraKind, item: Extra, ratio: number) {
  if (kind === "tags") return { x: 0, y: (item as { position?: number }).position ?? .5, width: 0, height: 0 };
  const width = extraWidth(kind, item);
  const height = kind === "hotspots" ? hotspotHeight(item as PageHotspot, ratio)
    : kind === "videos" ? videoHeight(item as PageVideo, ratio)
    : kind === "links" || kind === "stickers" ? width / ratio : (item as { height: number }).height;
  return { x: (item as { x: number }).x, y: (item as { y: number }).y, width, height };
}
export type PageAlignment = "left" | "center" | "right" | "top" | "middle" | "bottom";
export function alignExtra(kind: ExtraKind, item: Extra, alignment: PageAlignment, ratio: number): Extra {
  const box = extraBox(kind, item, ratio);
  const x = alignment === "left" ? 0 : alignment === "center" ? (1 - box.width) / 2 : alignment === "right" ? 1 - box.width : box.x;
  const y = alignment === "top" ? 0 : alignment === "middle" ? (1 - box.height) / 2 : alignment === "bottom" ? 1 - box.height : box.y;
  return transformExtra(kind, item, x - box.x, y - box.y, "move", ratio);
}
export const nudgeStep = (keys: { altKey: boolean; shiftKey: boolean }) => keys.altKey ? .001 : keys.shiftKey ? .02 : .005;
/** Snap an unrotated item box to page edges/centres only when it is already very close. */
export function snapExtraToPage(kind: ExtraKind, item: Extra, ratio: number): Extra {
  const box = extraBox(kind, item, ratio);
  const nearest = (at: number, extent: number) => [0, (1 - extent) / 2, 1 - extent].reduce((best, candidate) => Math.abs(candidate - at) < Math.abs(best - at) ? candidate : best, at + .0081);
  const x = nearest(box.x, box.width), y = nearest(box.y, box.height);
  return transformExtra(kind, item, Math.abs(x - box.x) <= .008 ? x - box.x : 0, Math.abs(y - box.y) <= .008 ? y - box.y : 0, "move", ratio);
}
