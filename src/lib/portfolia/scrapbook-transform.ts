import { transformFoldout, type Foldout, type ResizeCorner } from "./foldouts";
import { placeLink, placeVideo, type PageLink, type PageTag, type PageVideo } from "./page-extras";
export type ExtraKind = "foldouts" | "links" | "tags" | "videos";
export type Extra = Foldout | PageLink | PageTag | PageVideo;
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
