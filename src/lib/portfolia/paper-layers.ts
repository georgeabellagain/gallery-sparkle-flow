/** A bounded set of thin paper slabs: no hidden PDF textures or per-frame allocation. */
export function paperLayerPlan(leaves: number, share: number, depth: number, enabled: boolean) {
  if (!enabled || !Number.isFinite(depth) || depth <= 0 || !Number.isFinite(leaves) || !Number.isFinite(share)) return [];
  const count = Math.min(24, Math.max(0, Math.ceil(Math.max(0, leaves - 2) * Math.max(0, Math.min(1, share)) / 2)));
  return Array.from({ length: count }, (_, i) => ({
    z: (i + 0.5) * depth / count,
    thickness: depth / count * 0.82,
    offset: 0.012 * (i + 1) / count,
  }));
}
