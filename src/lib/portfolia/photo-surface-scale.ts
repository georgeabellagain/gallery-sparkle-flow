/** Texture size relative to the original surface; all PBR maps use the same UV transform. */
export function photoSurfaceScale(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(.1, Math.min(2, value)) : .5;
}
