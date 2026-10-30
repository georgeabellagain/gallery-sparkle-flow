/** Keep fullscreen multisampled surfaces within budget, independently of PDF texture detail. */
export function bookSurfaceRatio(width: number, height: number, quality: number, budget: number) {
  const fit = Math.sqrt(budget / (Math.max(1, width) * Math.max(1, height)));
  return Math.min(quality, fit * Math.min(1, quality));
}

/** Apply adaptation to the pixel budget too: fullscreen may already be budget-limited. */
export function bookMotionBudget(restBudget: number, moving: boolean, qualityScale = 1) {
  const scale = Math.max(.1, Math.min(1, qualityScale));
  return moving ? Math.min(restBudget, 5_200_000) * scale * scale : restBudget;
}

/** Studio pays for physical lighting and filtered shadows at every output pixel.
 * During motion use a bounded surface; page textures and settled/capture detail stay intact. */
export function studioMotionBudget(restBudget: number, moving: boolean, studio: boolean, capture = false) {
  return moving && studio && !capture ? Math.min(restBudget, restBudget <= 2_500_000 ? 1_500_000 : 2_600_000) : restBudget;
}

/** Keep recently used reader textures warm without evicting visible artwork. */
export function readerTextureEvictions<T extends { visible: boolean; usedAt: number }>(textures: readonly T[], limit = 8): T[] {
  return textures.filter(texture => !texture.visible).sort((a, b) => a.usedAt - b.usedAt).slice(0, Math.max(0, textures.length - limit));
}
