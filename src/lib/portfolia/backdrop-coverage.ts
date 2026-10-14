/** Enlarge a fixed photograph until the camera view, including pan, fits inside it. */
export function backdropCoverage(baseHeight: number, aspect: number, viewHeight: number, x: number, y: number) {
  return Math.max(1.25, (viewHeight + 2 * Math.abs(y)) / baseHeight, (viewHeight * aspect + 2 * Math.abs(x)) / (baseHeight * aspect)) * 1.02;
}
