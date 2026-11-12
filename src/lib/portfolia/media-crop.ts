/** Insets are fractions of the placed media box. They hide edges without moving or scaling the media. */
export const MEDIA_CROP_EDGES = ["top", "right", "bottom", "left"] as const;
export const MAX_MEDIA_CROP = .45;
export const MEDIA_BLEED = .5;
export type MediaCrop = Partial<Record<(typeof MEDIA_CROP_EDGES)[number], number>>;
export function validMediaCrop(value: unknown): value is MediaCrop | undefined {
  if (value === undefined) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([edge, n]) => (MEDIA_CROP_EDGES as readonly string[]).includes(edge) &&
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_MEDIA_CROP));
}
export function mediaCropInsets(crop?: MediaCrop): [number, number, number, number] {
  return [crop?.top ?? 0, crop?.right ?? 0, crop?.bottom ?? 0, crop?.left ?? 0];
}
export function mediaClipPath(crop?: MediaCrop) {
  return crop ? `inset(${mediaCropInsets(crop).map(n => `${n * 100}%`).join(" ")})` : undefined;
}
export function cropMediaBox(box: { x: number; y: number; width: number; height: number }, crop?: MediaCrop) {
  const [t, r, b, l] = mediaCropInsets(crop);
  return { x: box.x + box.width * l, y: box.y + box.height * t,
    width: box.width * (1 - l - r), height: box.height * (1 - t - b) };
}
export function clipMediaCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, crop?: MediaCrop) {
  if (!crop) return;
  const box = cropMediaBox({ x, y, width, height }, crop);
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
}
export function placeMediaAxis(value: number, extent: number) {
  // Keep a small grab area on the page even at the furthest allowed bleed.
  return Math.max(-Math.min(MEDIA_BLEED, extent * .95), Math.min(1 - Math.min(.05, extent * .05), value));
}
export function validMediaPosition(x: number, y: number) {
  return [x, y].every(n => Number.isFinite(n) && n >= -MEDIA_BLEED && n <= 1);
}
