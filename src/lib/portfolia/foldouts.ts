import { renderedKeys, type RenderedStudio } from "./rendered-studio";
import type { Leaf } from "./book-layout";
import { readablePageHotspots, readablePageLinks, readablePageVideos } from "./page-extras";
export const NOTE_FONT_IDS = ["serif", "sans", "mono", "hand", "neat", "script", "marker"] as const;
export type NoteFont = (typeof NOTE_FONT_IDS)[number];
export const NOTE_ALIGNS = ["left", "center", "right", "justify"] as const;
export type NoteAlign = (typeof NOTE_ALIGNS)[number];
export const NOTE_VALIGNS = ["top", "middle", "bottom"] as const;
export type NoteValign = (typeof NOTE_VALIGNS)[number];
export interface FoldoutSurface {
  colour: string;
  text: string;
  imageKey?: string;
  font?: NoteFont;
  fontSize?: number;
  /** Horizontal text alignment. Missing means left. */
  align?: NoteAlign;
  /** Vertical text position. Missing means top. */
  valign?: NoteValign;
  imageFit?: "contain" | "cover";
  imageScale?: number;
  imageX?: number;
  imageY?: number;
}
export interface Foldout {
  id: string;
  page: number;
  half: "left" | "right";
  title: string;
  /** Legacy image/colour fields remain readable. New notes use independent surfaces. */
  imageKey?: string;
  colour: string;
  outside?: FoldoutSurface;
  inside?: FoldoutSurface;
  style?: "foldout" | "sticky";
  openable?: boolean;
  hinge: "left" | "right" | "top" | "bottom" | "none";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Turn on the page in degrees, clockwise, about the note's centre. Missing means straight. */
  rotation?: number;
}
export interface PageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const MAX_FOLDOUTS = 12;
export const FOLDOUT_IMAGE_LIMIT = 8 * 1024 * 1024;
export const NOTE_TEXT_LIMIT = 1200;
/** Notes can be set at a slant, as they would be stuck into a scrapbook, but never upside down. */
export const MAX_NOTE_ROTATION = 30;
export const noteRotation = (f: Pick<Foldout, "rotation">) =>
  typeof f.rotation === "number" && Number.isFinite(f.rotation) ? Math.max(-MAX_NOTE_ROTATION, Math.min(MAX_NOTE_ROTATION, f.rotation)) : 0;
/** Rotates a note, snapping to straight within 2 degrees so it is easy to put back. */
export function rotateFoldout(f: Foldout, degrees: number): Foldout {
  const value = Math.round(Math.max(-MAX_NOTE_ROTATION, Math.min(MAX_NOTE_ROTATION, degrees)) * 10) / 10;
  const { rotation: _r, ...rest } = f;
  return Math.abs(value) < 2 ? rest : { ...rest, rotation: value };
}
/** A new note on a page, centred where it lands: a sticky note or a fold-out that opens from its left edge. */
export function newFoldout(id: string, page: number, half: "left" | "right", style: "sticky" | "foldout", point = { x: .5, y: .45 }): Foldout {
  const sticky = style === "sticky", width = sticky ? .26 : .32, height = sticky ? .2 : .34;
  return fitFoldout({
    id, page, half, style, title: sticky ? "Sticky note" : "Text note", colour: sticky ? "#f6e27a" : "#e5dcc6",
    hinge: sticky ? "top" : point.x < .5 ? "right" : "left",
    ...(sticky ? { openable: false } : {}),
    x: point.x - width / 2, y: point.y - height / 2, width, height,
    outside: { colour: sticky ? "#f6e27a" : "#e5dcc6", text: sticky ? "Write a note" : "Open note", ...(sticky ? { font: "hand" as const } : {}) },
    inside: { colour: "#fbf6e9", text: sticky ? "" : "Write your note here…" },
  });
}
const key = /^[a-zA-Z0-9_.-]{1,120}$/;
export function foldoutSurfaces(f: Foldout): {
  outside: FoldoutSurface;
  inside: FoldoutSurface;
} {
  return {
    outside: f.outside ?? { colour: f.colour, text: f.title },
    inside: f.inside ?? { colour: "#f5f1e7", text: "", imageKey: f.imageKey },
  };
}
export function validateFoldout(f: Foldout, pages: number): string | null {
  if (!f || typeof f !== "object" || !key.test(f.id))
    return "Choose a valid note.";
  if (!Number.isInteger(f.page) || f.page < 1 || f.page > pages)
    return "Choose a page in this PDF.";
  if (
    !["left", "right", "top", "bottom", "none"].includes(f.hinge) ||
    !["left", "right"].includes(f.half)
  )
    return "Choose an opening direction and spread half.";
  if (f.openable !== undefined && typeof f.openable !== "boolean") return "Choose whether the note is openable.";
  if (f.style !== undefined && !["foldout", "sticky"].includes(f.style)) return "Choose a note style.";
  if (f.style === "sticky" && f.hinge !== "top") return "Sticky notes open from the top.";
  if (f.rotation !== undefined && (typeof f.rotation !== "number" || !Number.isFinite(f.rotation) || Math.abs(f.rotation) > MAX_NOTE_ROTATION)) return "Choose a note angle up to 30 degrees.";
  if (typeof f.title !== "string" || !f.title.trim() || f.title.length > 60)
    return "Add a short note label (up to 60 characters).";
  if (!/^#[a-fA-F0-9]{6}$/.test(f.colour)) return "Choose a flap colour.";
  if (
    f.imageKey !== undefined &&
    (typeof f.imageKey !== "string" || !key.test(f.imageKey))
  )
    return "Choose a valid image.";
  for (const side of Object.values(foldoutSurfaces(f))) {
    if (side?.fontSize !== undefined && (!Number.isFinite(side.fontSize) || side.fontSize < 25 || side.fontSize > 300)) return "Choose a note font size from 25% to 300%.";
    if (
      side?.font !== undefined &&
      !(NOTE_FONT_IDS as readonly string[]).includes(side.font)
    )
      return "Choose a valid font.";
    if (
      (side?.align !== undefined &&
        !(NOTE_ALIGNS as readonly string[]).includes(side.align)) ||
      (side?.valign !== undefined &&
        !(NOTE_VALIGNS as readonly string[]).includes(side.valign))
    )
      return "Choose a valid text alignment.";
    if (
      side?.imageFit !== undefined &&
      !["contain", "cover"].includes(side.imageFit)
    )
      return "Choose a valid image fit.";
    for (const [field, min, max] of [
      ["imageScale", 0.25, 4],
      ["imageX", -1, 1],
      ["imageY", -1, 1],
    ] as const) {
      const value = side?.[field];
      if (
        value !== undefined &&
        (!Number.isFinite(value) || value < min || value > max)
      )
        return "Choose a valid image crop.";
    }
    if (
      !side ||
      !/^#[a-fA-F0-9]{6}$/.test(side.colour) ||
      typeof side.text !== "string" ||
      side.text.length > NOTE_TEXT_LIMIT
    )
      return "Choose a colour and text up to 1,200 characters for each side.";
    if (
      side.imageKey !== undefined &&
      (typeof side.imageKey !== "string" || !key.test(side.imageKey))
    )
      return "Choose a valid image.";
  }
  if (
    ![f.x, f.y, f.width, f.height].every(Number.isFinite) ||
    f.width < 0.08 - 1e-9 ||
    f.width > 1 ||
    f.height < 0.08 - 1e-9 ||
    f.height > 1
  )
    return "Choose a valid note size.";
  if (f.x < 0 || f.y < 0 || f.x + f.width > 1.0001 || f.y + f.height > 1.0001)
    return "Keep the closed note on the page.";
  return null;
}
export function readableFoldouts(value: unknown, pages: number): Foldout[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value
    .filter((f): f is Foldout => {
      if (validateFoldout(f, pages) || ids.has(f.id)) return false;
      ids.add(f.id);
      return true;
    })
    .slice(0, MAX_FOLDOUTS);
}
export function foldoutKeys(
  pdf?: { foldouts?: Foldout[]; links?: unknown; videos?: unknown; hotspots?: unknown; renderedStudio?: RenderedStudio; pages: number } | null,
): string[] {
  return [
    ...new Set([
      ...renderedKeys(pdf?.renderedStudio),
      ...readableFoldouts(pdf?.foldouts, pdf?.pages ?? 0).flatMap((f) =>
        Object.values(foldoutSurfaces(f))
          .map((s) => s.imageKey)
          .filter((k): k is string => !!k),
      ),
      // Custom website logos are stored like note images, so they sync, publish and clean up the same way.
      ...readablePageLinks(pdf?.links, pdf?.pages ?? 0)
        .map((l) => l.iconKey)
        .filter((k): k is string => !!k),
      // Page videos and their stills follow the same lifecycle.
      ...pageVideoKeys(pdf),
      // So do the pictures in hotspot pop-ups.
      ...readablePageHotspots(pdf?.hotspots, pdf?.pages ?? 0).map((h) => h.imageKey).filter((k): k is string => !!k),
    ]),
  ];
}
export function pageVideoKeys(pdf?: { videos?: unknown; pages: number } | null): string[] {
  return readablePageVideos(pdf?.videos, pdf?.pages ?? 0).flatMap((v) => [v.blobKey, v.posterKey]);
}
export function foldoutsForLeaf(items: Foldout[], leaf: Leaf): Foldout[] {
  return items.filter(
    (f) => f.page === leaf.page && (!leaf.half || f.half === leaf.half),
  );
}
export function fitFoldout(f: Foldout): Foldout {
  const width = Math.min(1, Math.max(0.08, f.width)),
    height = Math.min(1, Math.max(0.08, f.height));
  return {
    ...f,
    width,
    height,
    x: Math.min(1 - width, Math.max(0, f.x)),
    y: Math.min(1 - height, Math.max(0, f.y)),
  };
}
export type ResizeCorner = "nw" | "ne" | "sw" | "se";
/** Normalised pointer deltas; resize pins the opposite corner. */
export function transformFoldout(
  f: Foldout,
  dx: number,
  dy: number,
  handle: "move" | ResizeCorner,
): Foldout {
  if (handle === "move") return fitFoldout({ ...f, x: f.x + dx, y: f.y + dy });
  const left = handle.includes("w")
    ? Math.max(0, Math.min(f.x + f.width - 0.08, f.x + dx))
    : f.x;
  const top = handle.includes("n")
    ? Math.max(0, Math.min(f.y + f.height - 0.08, f.y + dy))
    : f.y;
  const right = handle.includes("e")
    ? Math.min(1, Math.max(f.x + 0.08, f.x + f.width + dx))
    : f.x + f.width;
  const bottom = handle.includes("s")
    ? Math.min(1, Math.max(f.y + 0.08, f.y + f.height + dy))
    : f.y + f.height;
  return { ...f, x: left, y: top, width: right - left, height: bottom - top };
}
