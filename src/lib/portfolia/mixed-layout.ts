import type { Leaf, Spread } from "./book-layout";

/** A little leeway, so a page that is nearly square is never taken for portrait or landscape. */
const MARGIN = 1.02;

/**
 * A portrait first page followed only by landscape pages: a front cover and then sheets that are two-page spreads.
 * The flipbook shows exactly that, whatever "My PDF contains" says. Scroll and page by page are unaffected.
 */
export function coverWithSpreads(sizes: { w: number; h: number }[]): boolean {
  if (sizes.length < 2) return false;
  const first = sizes[0]!;
  if (!(first.h > first.w * MARGIN)) return false;
  return sizes.slice(1).every((size) => size.w > size.h * MARGIN);
}

/**
 * The cover alone on the right, then each landscape sheet as a spread of its left and right halves. Hidden sheets
 * (pages not in `visible`) are left out; the cover always stays, as the book needs it to open from.
 */
export function coverThenSpreads(count: number, visible?: readonly number[]): { leaves: Leaf[]; spreads: Spread[] } {
  const leaves: Leaf[] = [{ page: 1 }];
  const spreads: Spread[] = [[null, 0]];
  for (let page = 2; page <= count; page++) {
    if (visible && !visible.includes(page)) continue;
    const left = leaves.length;
    leaves.push({ page, half: "left" }, { page, half: "right" });
    spreads.push([left, left + 1]);
  }
  return { leaves, spreads };
}
