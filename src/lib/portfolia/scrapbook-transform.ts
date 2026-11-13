import { transformFoldout, type Foldout, type ResizeCorner } from "./foldouts";
import { placeSlideshow, type PageSlideshow, placeHotspot, placeJump, placeLink, placeSpotlight, placeSticker, placeVideo, type PageHotspot, type PageJump, type PageLink, type PageSpotlight, type PageSticker, type PageTag, type PageVideo } from "./page-extras";
export type ExtraKind = "foldouts" | "links" | "tags" | "videos" | "spotlights" | "jumps" | "stickers" | "hotspots" | "slideshows";
export type Extra = Foldout | PageLink | PageTag | PageVideo | PageSpotlight | PageJump | PageSticker | PageHotspot | PageSlideshow;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function transformExtra(
  kind: ExtraKind,
  item: Extra,
  dx: number,
  dy: number,
  handle: "move" | ResizeCorner,
  ratio: number,
  aspect = 1,
): Extra {
  if (kind === "foldouts") return transformFoldout(item as Foldout, dx, dy, handle);
  if (kind === "tags") {
    const tag = item as PageTag;
    return handle === "move"
      ? { ...tag, position: clamp((tag.position ?? 0.5) + dy, 0.08, 0.92) }
      : { ...tag, scale: clamp((tag.scale ?? 1) + dy * 8, 0.5, 2) };
  }
  if (kind === "videos") {
    const video = item as PageVideo;
    if (handle === "move") return placeVideo(video, video.x + dx, video.y + dy, video.width, ratio);
    const west = handle.includes("w"), north = handle.includes("n");
    const horizontal = west ? -dx : dx, vertical = north ? -dy : dy;
    const next = placeVideo(video, video.x, video.y, video.width + (Math.abs(horizontal) >= Math.abs(vertical * video.aspect * ratio) ? horizontal : vertical * video.aspect * ratio), ratio);
    return placeVideo(next, west ? video.x + video.width - next.width : video.x,
      north ? video.y + video.height - (next.height) : video.y, next.width, ratio);
  }
  if (kind === "jumps") {
    // A page link's box is any shape, like a spotlight: it covers one line of a contents page.
    const j = item as PageJump;
    return handle === "move" ? placeJump(j, j.x + dx, j.y + dy, j.width, j.height) : placeJump(j, j.x, j.y, j.width + dx, j.height + dy);
  }
  if (kind === "slideshows") {
    const s = item as PageSlideshow;
    if (handle === "move") return placeSlideshow(s, s.x + dx, s.y + dy, s.width, s.height);
    const west = handle.includes("w"), north = handle.includes("n");
    const horizontal = west ? -dx : dx, vertical = north ? -dy : dy;
    const next = placeSlideshow(s, s.x, s.y, s.width + horizontal, s.height + vertical);
    return placeSlideshow(next, west ? s.x + s.width - next.width : s.x,
      north ? s.y + s.height - (next.height) : s.y, next.width, next.height);
  }
  if (kind === "hotspots") {
    const h = item as PageHotspot;
    return handle === "move" ? placeHotspot(h, h.x + dx, h.y + dy, h.size, ratio) : placeHotspot(h, h.x, h.y, h.size + dx, ratio);
  }
  if (kind === "stickers") {
    const s = item as PageSticker;
    if (handle === "move") return placeSticker(s, s.x + dx, s.y + dy, s.size, ratio);
    const west = handle.includes("w"), north = handle.includes("n");
    const horizontal = west ? -dx : dx, vertical = north ? -dy : dy;
    const horizontalSize = horizontal / Math.min(1, aspect);
    const verticalSize = vertical * ratio / Math.min(1, 1 / aspect);
    const next = placeSticker(s, s.x, s.y, s.size + (Math.abs(horizontalSize) >= Math.abs(verticalSize) ? horizontalSize : verticalSize), ratio);
    const delta = s.size - next.size;
    const mx = (1 - Math.min(1, aspect)) / 2, my = (1 - Math.min(1, 1 / aspect)) / 2;
    return placeSticker(next, s.x + delta * (west ? 1 - Math.max(mx, s.crop?.right ?? 0) : Math.max(mx, s.crop?.left ?? 0)),
      s.y + delta / ratio * (north ? 1 - Math.max(my, s.crop?.bottom ?? 0) : Math.max(my, s.crop?.top ?? 0)), next.size, ratio);
  }
  if (kind === "spotlights") {
    // A spotlight is any shape: the bottom-right handle changes width and height freely.
    const s = item as PageSpotlight;
    return handle === "move"
      ? placeSpotlight(s, s.x + dx, s.y + dy, s.width, s.height)
      : placeSpotlight(s, s.x, s.y, s.width + dx, s.height + dy);
  }
  const link = item as PageLink;
  return placeLink(
    handle === "move"
      ? link
      : { ...link, size: clamp(link.size + Math.max(dx, dy * ratio), 0.02, 0.4) },
    handle === "move" ? link.x + dx : link.x,
    handle === "move" ? link.y + dy : link.y,
    ratio,
  );
}
/** How wide an item is, in page widths (a tab sits on the edge and has none). */
export function extraWidth(kind: ExtraKind, item: Extra): number {
  if (kind === "tags") return 0;
  if (kind === "links" || kind === "stickers" || kind === "hotspots") return (item as PageLink | PageSticker | PageHotspot).size;
  return (item as Foldout | PageVideo | PageSpotlight | PageJump).width;
}
/**
 * Moves an item onto another page of the spread, at `x` in that page's own widths (it may start off the page, as
 * when dropped across the spine); it is then kept on the page like any move.
 */
export function moveToPage(kind: ExtraKind, item: Extra, page: number, half: "left" | "right", x: number, ratio: number): Extra {
  const moved = { ...item, page, half } as Extra;
  const from = (moved as { x?: number }).x ?? 0;
  return transformExtra(kind, moved, x - from, 0, "move", ratio);
}
