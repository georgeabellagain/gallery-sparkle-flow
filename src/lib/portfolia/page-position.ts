type Rect = { left: number; top: number; width: number; height: number };

/** Pages move through viewport-fixed world coordinates; lights never follow a page. */
export function pageWorldRect(page: Rect, viewport: Rect, worldWidth = 2.3) {
  const unit = worldWidth / Math.max(1, viewport.width);
  return {
    x: (page.left + page.width / 2 - viewport.left - viewport.width / 2) * unit,
    y: (viewport.top + viewport.height / 2 - page.top - page.height / 2) * unit,
    width: page.width * unit,
    height: page.height * unit,
  };
}
