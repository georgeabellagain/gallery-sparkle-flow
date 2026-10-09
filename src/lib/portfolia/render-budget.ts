/** Keep fullscreen multisampled surfaces within budget, independently of PDF texture detail. */
export function bookSurfaceRatio(width: number, height: number, quality: number, budget: number) {
  const fit = Math.sqrt(budget / (Math.max(1, width) * Math.max(1, height)));
  return Math.min(quality, fit * Math.min(1, quality));
}

/** Movement has a tighter fill-rate budget; settled artwork keeps its reading detail. */
export function bookMotionBudget(restBudget: number, moving: boolean) {
  return moving ? Math.min(restBudget, 1_300_000) : restBudget;
}

/** Keep recently used reader textures warm without evicting visible artwork. */
export function readerTextureEvictions<T extends { visible: boolean; usedAt: number }>(textures: readonly T[], limit = 8): T[] {
  return textures.filter(texture => !texture.visible).sort((a, b) => a.usedAt - b.usedAt).slice(0, Math.max(0, textures.length - limit));
}
