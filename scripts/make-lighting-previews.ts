// Makes the small preview copy of every Studio lighting file (public/studio/hdri/lighting-N-preview.hdr).
// Run after adding or changing a lighting file:  node --import tsx scripts/make-lighting-previews.ts
import { readFileSync, writeFileSync } from "node:fs";
import { HDRI_PRESETS } from "../src/lib/portfolia/lighting";
import { parseRgbe } from "../src/lib/portfolia/rgbe";
import { downsampleRgb, encodeRgbe } from "../src/lib/portfolia/environment-pixels";
import { environmentFile } from "../src/lib/portfolia/prepared-environment";

const PREVIEW_WIDTH = 256;
for (const preset of HDRI_PRESETS) {
  const bytes = readFileSync(`public${preset.file}`);
  const { width, height, rgb } = parseRgbe(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const small = downsampleRgb(rgb, width, height, Math.max(1, Math.round(width / PREVIEW_WIDTH)));
  const out = encodeRgbe(small.width, small.height, small.rgb);
  writeFileSync(`public${environmentFile(preset.id, "preview")}`, out);
  console.log(`${preset.id}: ${width}x${height} -> ${small.width}x${small.height}, ${Math.round(out.length / 1024)} KB`);
}
