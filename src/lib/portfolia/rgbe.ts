/**
 * Reads a Radiance (.hdr) picture, the common format for lighting environments.
 * Handles the usual run-length scanlines and the flat form. Returns linear
 * red, green and blue values (three numbers per pixel), top row first.
 */
export function parseRgbe(buffer: ArrayBuffer): { width: number; height: number; rgb: Float32Array } {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  const line = () => {
    let end = pos;
    while (end < bytes.length && bytes[end] !== 10) end++;
    let text = "";
    for (let i = pos; i < end; i++) text += String.fromCharCode(bytes[i]!);
    pos = end + 1;
    return text;
  };
  const byte = () => {
    if (pos >= bytes.length) throw new Error("The lighting file is incomplete");
    return bytes[pos++]!;
  };
  if (!line().startsWith("#?")) throw new Error("Not a Radiance picture");
  let size: RegExpExecArray | null = null;
  while (pos < bytes.length && !size) size = /^-Y (\d+) \+X (\d+)$/.exec(line().trim());
  if (!size) throw new Error("The lighting file has no picture size");
  const height = Number(size[1]);
  const width = Number(size[2]);
  if (!width || !height || width * height > 16_000_000) throw new Error("Unreasonable picture size");

  const rgbe = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    const runLength = width >= 8 && width < 32768 && bytes[pos] === 2 && bytes[pos + 1] === 2 && !(bytes[pos + 2]! & 0x80);
    if (runLength) {
      if (((bytes[pos + 2]! << 8) | bytes[pos + 3]!) !== width) throw new Error("A scanline has the wrong width");
      pos += 4;
      for (let channel = 0; channel < 4; channel++) {
        let x = 0;
        while (x < width) {
          let count = byte();
          if (count > 128) {
            count -= 128;
            if (x + count > width) throw new Error("A run goes past the end of its scanline");
            const value = byte();
            for (let i = 0; i < count; i++) rgbe[row + x++ * 4 + channel] = value;
          } else {
            if (count === 0 || x + count > width) throw new Error("A run goes past the end of its scanline");
            for (let i = 0; i < count; i++) rgbe[row + x++ * 4 + channel] = byte();
          }
        }
      }
    } else {
      for (let i = 0; i < width * 4; i++) rgbe[row + i] = byte();
    }
  }

  // value = mantissa * 2^(exponent - 128) / 255, the convention three.js uses
  const scale = new Float32Array(256);
  for (let e = 1; e < 256; e++) scale[e] = Math.pow(2, e - 128) / 255;
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < rgbe.length; i += 4, j += 3) {
    const f = scale[rgbe[i + 3]!]!;
    rgb[j] = rgbe[i]! * f;
    rgb[j + 1] = rgbe[i + 1]! * f;
    rgb[j + 2] = rgbe[i + 2]! * f;
  }
  return { width, height, rgb };
}
