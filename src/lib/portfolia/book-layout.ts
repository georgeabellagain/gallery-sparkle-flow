export type Leaf = { page: number; half?: "left" | "right" };
export type Spread = [number | null, number | null];

/** Keep the physical book identical on phones; only the camera framing changes. */
export function bookLayout(count: number, readySpreads: boolean) {
  const leaves: Leaf[] = Array.from({ length: count }, (_, i) => ({ page: i + 1 }));
  if (readySpreads) {
    const halves = leaves.flatMap(({ page }) => [
      { page, half: "left" as const },
      { page, half: "right" as const },
    ]);
    return { leaves: halves, spreads: leaves.map((_, i): Spread => [i * 2, i * 2 + 1]) };
  }
  const spreads: Spread[] = [[null, 0]];
  for (let i = 1; i < count; i += 2) spreads.push([i, i + 1 < count ? i + 1 : null]);
  return { leaves, spreads };
}

export function spreadIndex(spreads: Spread[], leaf: number) {
  return Math.max(
    0,
    spreads.findIndex((spread) => spread.includes(leaf)),
  );
}

export function bookFocus(spread: Spread, leaf: number, narrow: boolean) {
  if (narrow) return spread[0] === leaf ? -0.5 : 0.5;
  return spread[0] === null ? 0.5 : spread[1] === null ? -0.5 : 0;
}
