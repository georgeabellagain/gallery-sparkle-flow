import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DataUtils } from "three";
import { HDRI_PRESETS } from "../src/lib/portfolia/lighting";
import { parseRgbe } from "../src/lib/portfolia/rgbe";
import { averageEnvironment, downsampleRgb, encodeRgbe, prepareEnvironment, toHalf } from "../src/lib/portfolia/environment-pixels";
import { environmentFile } from "../src/lib/portfolia/prepared-environment";

const read = (path: string) => { const b = readFileSync(`public${path}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

test("the fast half-float conversion matches three.js", () => {
  for (const v of [0, 1, -1, 0.285, 1e-5, 3.14159, 65504, 60000, 1e-8, 123.456, 0.5, 2 ** -14, 2 ** -20]) assert.equal(toHalf(v), DataUtils.toHalfFloat(v), String(v));
});

test("written lighting reads back within RGBE precision", () => {
  const rgb = new Float32Array([0.2, 0.4, 0.8, 12, 3, 0.01, 0, 0, 0, 1500, 2000, 900]);
  const back = parseRgbe(encodeRgbe(2, 2, rgb).buffer as ArrayBuffer).rgb;
  rgb.forEach((v, i) => assert.ok(Math.abs(back[i]! - v) <= Math.max(1e-6, Math.max(...rgb.slice(i - (i % 3), i - (i % 3) + 3)) / 128), `${i}: ${back[i]} vs ${v}`));
  assert.deepEqual([...downsampleRgb(new Float32Array([1, 1, 1, 3, 3, 3, 5, 5, 5, 7, 7, 7]), 2, 2, 2).rgb], [4, 4, 4]);
});

test("every lighting choice has a small preview that keeps its colour and brightness", () => {
  for (const preset of HDRI_PRESETS) {
    const full = parseRgbe(read(preset.file));
    const previewBytes = read(environmentFile(preset.id, "preview"));
    assert.ok(previewBytes.byteLength < 140 * 1024, `${preset.id} preview is small`);
    const preview = parseRgbe(previewBytes);
    assert.equal(preview.width, 256);
    const a = averageEnvironment(full.rgb, full.width, full.height), b = averageEnvironment(preview.rgb, preview.width, preview.height);
    a.forEach((v, i) => assert.ok(Math.abs(b[i]! - v) <= v * 0.03 + 1e-4, `${preset.id} channel ${i}: ${b[i]} vs ${v}`));
    const prepared = prepareEnvironment(previewBytes);
    assert.equal(prepared.pixels.length, 256 * 128 * 4);
  }
});
