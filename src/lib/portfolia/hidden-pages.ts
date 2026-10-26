/**
 * Pages the creator has hidden from readers. They stay in the PDF (and in the editor while placing scrapbook items)
 * but every reading style skips them, along with anything placed on them. At least one page always stays visible.
 */
export function readableHiddenPages(value: unknown, pages: number): number[] {
  if (!Array.isArray(value) || pages < 2) return [];
  const hidden = [...new Set(value.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= pages))].sort((a, b) => a - b);
  return hidden.length >= pages ? hidden.slice(0, pages - 1) : hidden;
}

/** The pages readers see, in order. */
export function visiblePageList(pages: number, hidden: ReadonlySet<number>): number[] {
  return Array.from({ length: pages }, (_, i) => i + 1).filter((n) => !hidden.has(n));
}

/** A hidden page's nearest visible page: the next one after it, or else the last one before it. */
export function nearestVisible(page: number, visible: readonly number[]): number {
  if (!visible.length) return page;
  return visible.find((n) => n >= page) ?? visible[visible.length - 1]!;
}

/** The visible page `step` places on from `page` (or from the page a hidden one gives way to). */
export function stepVisible(page: number, step: number, visible: readonly number[]): number {
  if (!visible.length) return page;
  const at = visible.indexOf(nearestVisible(page, visible));
  return visible[Math.max(0, Math.min(visible.length - 1, at + step))]!;
}

/** Which of the visible pages this is, counting from 1, for "3 / 12". */
export const visiblePosition = (page: number, visible: readonly number[]) => visible.indexOf(nearestVisible(page, visible)) + 1;
