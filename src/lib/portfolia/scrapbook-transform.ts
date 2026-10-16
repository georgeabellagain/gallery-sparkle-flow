import { transformFoldout, type Foldout, type ResizeCorner } from "./foldouts";
import { placeLink, type PageLink, type PageTag } from "./page-extras";
export type ExtraKind = "foldouts" | "links" | "tags";
export type Extra = Foldout | PageLink | PageTag;
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
