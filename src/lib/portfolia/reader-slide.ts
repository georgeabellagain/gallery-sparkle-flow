export const READER_SLIDE_MS = 420;
export const READER_SLIDE_DISTANCE = .12;

/** A bounded slide offset; layout dimensions and scroll extent never change. */
export function readerSlideOffset(elapsed: number, width: number, direction: 1 | -1) {
  const progress = Math.max(0, Math.min(1, elapsed / READER_SLIDE_MS));
  if (progress === 1 || width <= 0) return 0;
  return direction * Math.max(0, width) * READER_SLIDE_DISTANCE * (1 - progress) ** 3;
}
