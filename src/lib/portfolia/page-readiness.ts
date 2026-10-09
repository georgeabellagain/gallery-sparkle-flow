/** Scroll opens only when every full page is prepared, never from a cached thumbnail. */
export function createPageReadiness(total: number) {
  const completed = new Set<number>();
  let failed: number | null = null;
  return {
    mark(page: number, success: boolean) {
      if (Number.isInteger(page) && page >= 1 && page <= total) {
        if (success) completed.add(page);
        else failed ??= page;
      }
      return { completed: completed.size, failed, ready: total > 0 && failed === null && completed.size === total };
    },
  };
}
