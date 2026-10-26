export type Leaf = { page: number; half?: "left" | "right" };
export type Spread = [number | null, number | null];

/**
 * Keep the physical book identical on phones; only the camera framing changes. `pages` lists the pages readers
 * see (hidden ones left out); omitted, every page is in the book.
 */
export function bookLayout(count: number, readySpreads: boolean, pages?: readonly number[]) {
  const leaves: Leaf[] = (pages ?? Array.from({ length: count }, (_, i) => i + 1)).map((page) => ({ page }));
  if (readySpreads) {
    const halves = leaves.flatMap(({ page }) => [
      { page, half: "left" as const },
      { page, half: "right" as const },
    ]);
    return { leaves: halves, spreads: leaves.map((_, i): Spread => [i * 2, i * 2 + 1]) };
  }
  const spreads: Spread[] = [[null, 0]];
  for (let i = 1; i < leaves.length; i += 2) spreads.push([i, i + 1 < leaves.length ? i + 1 : null]);
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
