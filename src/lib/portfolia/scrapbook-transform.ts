import { transformFoldout, type Foldout, type ResizeCorner } from "./foldouts";
import { placeJump, placeLink, placeSpotlight, placeSticker, placeVideo, type PageJump, type PageLink, type PageSpotlight, type PageSticker, type PageTag, type PageVideo } from "./page-extras";
export type ExtraKind = "foldouts" | "links" | "tags" | "videos" | "spotlights" | "jumps" | "stickers";
export type Extra = Foldout | PageLink | PageTag | PageVideo | PageSpotlight | PageJump | PageSticker;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function transformExtra(
  kind: ExtraKind,
  item: Extra,
  dx: number,
  dy: number,
  handle: "move" | ResizeCorner,
  ratio: number,
): Extra {
  if (kind === "foldouts") return transformFoldout(item as Foldout, dx, dy, handle);
  if (kind === "tags") {
    const tag = item as PageTag;
    return handle === "move"
      ? { ...tag, position: clamp((tag.position ?? 0.5) + dy, 0.08, 0.92) }
      : { ...tag, scale: clamp((tag.scale ?? 1) + dy * 8, 0.5, 2) };
  }
  if (kind === "videos") {
    // A video keeps its own shape: the bottom-right handle changes its width, the height follows.
    const video = item as PageVideo;
    return handle === "move"
      ? placeVideo(video, video.x + dx, video.y + dy, video.width, ratio)
      : placeVideo(video, video.x, video.y, video.width + Math.max(dx, dy * video.aspect * ratio), ratio);
  }
  if (kind === "jumps") {
    // A page link's box is any shape, like a spotlight: it covers one line of a contents page.
    const j = item as PageJump;
    return handle === "move" ? placeJump(j, j.x + dx, j.y + dy, j.width, j.height) : placeJump(j, j.x, j.y, j.width + dx, j.height + dy);
  }
  if (kind === "stickers") {
    // A sticker stays square: its corner handle changes its size.
    const s = item as PageSticker;
    return handle === "move" ? placeSticker(s, s.x + dx, s.y + dy, s.size, ratio) : placeSticker(s, s.x, s.y, s.size + Math.max(dx, dy * ratio), ratio);
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
  if (kind === "links" || kind === "stickers") return (item as PageLink | PageSticker).size;
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
