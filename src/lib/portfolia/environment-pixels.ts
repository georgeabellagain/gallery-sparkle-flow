import { parseRgbe } from "./rgbe";

/**
 * Turning a lighting photograph into what the GPU takes: decoded, averaged and converted to half floats. Free of
 * three.js so it can run in a worker (environment.worker.ts); the Studio scene receives the finished pixels.
 */

export type PreparedEnvironment = { width: number; height: number; pixels: Uint16Array; colour: [number, number, number] };

/** Average radiance over a sphere, retaining the selected environment's colour and energy. */
export function averageEnvironment(rgb: Float32Array, width: number, height: number): [number, number, number] {
  const sums = [0, 0, 0]; let total = 0;
  for (let y = 0; y < height; y++) {
    const weight = Math.sin(Math.PI * (y + .5) / height);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) sums[c]! += Math.min(60000, Math.max(0, rgb[offset + c]!)) * weight;
      total += weight;
    }
  }
  return sums.map(value => value / Math.max(1e-9, total)) as [number, number, number];
}

// Float to half by table lookup (the method three.js's DataUtils uses), built once.
const floatView = new Float32Array(1);
const bits = new Uint32Array(floatView.buffer);
const base = new Uint32Array(512);
const shift = new Uint32Array(512);
for (let i = 0; i < 256; ++i) {
  const e = i - 127;
  if (e < -27) { base[i] = 0x0000; base[i | 0x100] = 0x8000; shift[i] = shift[i | 0x100] = 24; }
  else if (e < -14) { base[i] = 0x0400 >> (-e - 14); base[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000; shift[i] = shift[i | 0x100] = -e - 1; }
  else if (e <= 15) { base[i] = (e + 15) << 10; base[i | 0x100] = ((e + 15) << 10) | 0x8000; shift[i] = shift[i | 0x100] = 13; }
  else if (e < 128) { base[i] = 0x7c00; base[i | 0x100] = 0xfc00; shift[i] = shift[i | 0x100] = 24; }
  else { base[i] = 0x7c00; base[i | 0x100] = 0xfc00; shift[i] = shift[i | 0x100] = 13; }
}
export function toHalf(value: number): number {
  floatView[0] = value;
  const f = bits[0]!;
  const e = (f >> 23) & 0x1ff;
  return base[e]! + ((f & 0x007fffff) >> shift[e]!);
}

/** Linear RGB rows (top first) to the half-float RGBA the GPU takes, bottom row first, clamped as before. */
export function environmentPixels(rgb: Float32Array, width: number, height: number): Uint16Array {
  const pixels = new Uint16Array(width * height * 4);
  const one = toHalf(1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = ((height - 1 - y) * width + x) * 3, to = (y * width + x) * 4;
    pixels[to] = toHalf(Math.min(rgb[from]!, 60000));
    pixels[to + 1] = toHalf(Math.min(rgb[from + 1]!, 60000));
    pixels[to + 2] = toHalf(Math.min(rgb[from + 2]!, 60000));
    pixels[to + 3] = one;
  }
  return pixels;
}

export function prepareEnvironment(buffer: ArrayBuffer): PreparedEnvironment {
  const { width, height, rgb } = parseRgbe(buffer);
  return { width, height, pixels: environmentPixels(rgb, width, height), colour: averageEnvironment(rgb, width, height) };
}

/** Averages `factor`×`factor` blocks of linear RGB: how the small preview lighting files are made. */
export function downsampleRgb(rgb: Float32Array, width: number, height: number, factor: number) {
  const w = Math.floor(width / factor), h = Math.floor(height / factor);
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) sum += rgb[((y * factor + dy) * width + x * factor + dx) * 3 + c]!;
      out[(y * w + x) * 3 + c] = sum / (factor * factor);
    }
  }
  return { width: w, height: h, rgb: out };
}

/** Writes linear RGB as a flat (not run-length) Radiance picture that parseRgbe reads. */
export function encodeRgbe(width: number, height: number, rgb: Float32Array): Uint8Array {
  const header = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
  const out = new Uint8Array(header.length + width * height * 4);
  out.set(header);
  for (let i = 0, o = header.length; i < width * height; i++, o += 4) {
    const r = rgb[i * 3]!, g = rgb[i * 3 + 1]!, b = rgb[i * 3 + 2]!;
    const v = Math.max(r, g, b);
    if (v < 1e-32) continue;
    // v = f * 2^e with f in [0.5, 1), as C's frexp gives it.
    const e = Math.floor(Math.log2(v)) + 1;
    if (e + 128 < 1 || e + 128 > 255) continue;
    // parseRgbe reads value = mantissa * 2^(exponent - 128) / 255.
    const scale = 255 / Math.pow(2, e);
    out[o] = Math.min(255, Math.round(r * scale)); out[o + 1] = Math.min(255, Math.round(g * scale)); out[o + 2] = Math.min(255, Math.round(b * scale));
    out[o + 3] = e + 128;
  }
  return out;
}
