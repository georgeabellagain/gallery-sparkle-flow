/**
 * Scroll opens only when the required full pages are prepared, never from a cached thumbnail. A local PDF
 * requires every page; a streamed one only the pages the reader opens on, so it never waits for the whole file.
 */
export function createPageReadiness(total: number, required?: number[]) {
  const completed = new Set<number>();
  const needed = new Set((required ?? Array.from({ length: total }, (_, i) => i + 1)).filter((page) => Number.isInteger(page) && page >= 1 && page <= total));
  let failed: number | null = null;
  return {
    mark(page: number, success: boolean) {
      if (Number.isInteger(page) && page >= 1 && page <= total) {
        if (success) completed.add(page);
        else if (needed.has(page)) failed ??= page;
      }
      const ready = total > 0 && needed.size > 0 && failed === null && [...needed].every((p) => completed.has(p));
      return { completed: completed.size, failed, ready };
    },
  };
}
