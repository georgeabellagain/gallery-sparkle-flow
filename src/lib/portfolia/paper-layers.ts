/** Bounded paper slabs, with no hidden PDF textures. Leaf indices are zero-based. */
export function paperLayerPlan(leaves: number, share: number, depth: number, enabled: boolean, leaf?: number) {
  if (!enabled || !Number.isFinite(depth) || depth <= 0 || !Number.isFinite(leaves) || !Number.isFinite(share)) return [];
  // No offset behind the front cover, page 2 or the closing page.
  if (leaf !== undefined && (!Number.isFinite(leaf) || leaf <= 1 || leaf >= leaves - 1)) return [];
  const count = Math.min(24, Math.max(0, Math.ceil(Math.max(0, leaves - 2) * Math.max(0, Math.min(1, share)) / 2)));
  return Array.from({ length: count }, (_, i) => ({
    z: (i + 0.5) * depth / count,
    thickness: depth / count * 0.82,
    offset: 0.032 * Math.sqrt((i + 1) / count),
  }));
}

/** A soft contact shade, fading to clean paper at the exposed rim. */
export function paperLayerShade(u: number, v: number) {
  const edge = Math.max(0, Math.min(u, 1 - u, v, 1 - v));
  const t = Math.min(1, edge / 0.04);
  return 1 - 0.1 * t * t * (3 - 2 * t);
}
