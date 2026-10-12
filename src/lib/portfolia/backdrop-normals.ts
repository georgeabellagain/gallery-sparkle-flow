/** Subtle image-derived relief: remove broad photographic shading before estimating surface normals. */
export function backdropNormals(rgba: Uint8ClampedArray, width: number, height: number) {
  const luminance = new Float32Array(width * height), relief = new Float32Array(width * height);
  const at = (x: number, y: number) => luminance[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))]!;
  for (let i = 0; i < luminance.length; i++) luminance[i] = (rgba[i * 4]! * .2126 + rgba[i * 4 + 1]! * .7152 + rgba[i * 4 + 2]! * .0722) / 255;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let smooth = 0;
    for (const dy of [-2, 0, 2]) for (const dx of [-2, 0, 2]) smooth += at(x + dx, y + dy);
    relief[y * width + x] = at(x, y) - smooth / 9;
  }
  const sample = (x: number, y: number) => relief[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))]!;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = -(sample(x + 1, y) - sample(x - 1, y)) * 2;
    const ny = (sample(x, y + 1) - sample(x, y - 1)) * 2;
    const length = Math.hypot(nx, ny, 1), i = (y * width + x) * 4;
    pixels[i] = Math.round((nx / length * .5 + .5) * 255);
    pixels[i + 1] = Math.round((ny / length * .5 + .5) * 255);
    pixels[i + 2] = Math.round((1 / length * .5 + .5) * 255); pixels[i + 3] = 255;
  }
  return pixels;
}
