import type { Leaf } from "./book-layout";

export interface Foldout {
  id: string;
  page: number;
  /** Which physical half to use when the PDF page is a complete spread. */
  half: "left" | "right";
  title: string;
  imageKey: string;
  hinge: "left" | "right";
  colour: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const MAX_FOLDOUTS = 12;
export const FOLDOUT_IMAGE_LIMIT = 8 * 1024 * 1024;
const key = /^[a-zA-Z0-9_.-]{1,120}$/;
export function validateFoldout(f: Foldout, pages: number): string | null {
  if (!f || !key.test(f.id) || !key.test(f.imageKey))
    return "Choose an image for this fold-out.";
  if (!Number.isInteger(f.page) || f.page < 1 || f.page > pages)
    return "Choose a page in this PDF.";
  if (
    !["left", "right"].includes(f.hinge) ||
    !["left", "right"].includes(f.half)
  )
    return "Choose an opening direction and spread half.";
  if (typeof f.title !== "string" || !f.title.trim() || f.title.length > 60)
    return "Add a short image description (up to 60 characters).";
  if (!/^#[a-fA-F0-9]{6}$/.test(f.colour)) return "Choose a flap colour.";
  if (
    ![f.x, f.y, f.width, f.height].every(Number.isFinite) ||
    f.width < 0.18 ||
    f.width > 0.45 ||
    f.height < 0.18 ||
    f.height > 0.7
  )
    return "Choose a valid fold-out size.";
  const left = f.hinge === "left" ? f.x - f.width : f.x;
  const right = f.hinge === "left" ? f.x + f.width : f.x + 2 * f.width;
  if (left < -0.0001 || right > 1.0001 || f.y < 0 || f.y + f.height > 1.0001)
    return "Keep the opened fold-out inside the page.";
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
  pdf?: { foldouts?: Foldout[]; pages: number } | null,
): string[] {
  return [
    ...new Set(
      readableFoldouts(pdf?.foldouts, pdf?.pages ?? 0).map((f) => f.imageKey),
    ),
  ];
}
export function foldoutsForLeaf(items: Foldout[], leaf: Leaf): Foldout[] {
  return items.filter(
    (f) => f.page === leaf.page && (!leaf.half || f.half === leaf.half),
  );
}
/** Changing hinge/size keeps both opened panels on their physical page. */
export function fitFoldout(f: Foldout): Foldout {
  const min = f.hinge === "left" ? f.width : 0;
  const max = f.hinge === "left" ? 1 - f.width : 1 - 2 * f.width;
  return {
    ...f,
    x: Math.min(max, Math.max(min, f.x)),
    y: Math.min(1 - f.height, Math.max(0, f.y)),
  };
}
