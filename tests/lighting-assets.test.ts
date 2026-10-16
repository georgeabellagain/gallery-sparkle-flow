import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { HDRI_PRESETS } from "../src/lib/portfolia/lighting";
import { parseRgbe } from "../src/lib/portfolia/rgbe";
test("all fifteen lighting choices have a decodable local environment and preview", () => {
  assert.equal(HDRI_PRESETS.length, 15);
  assert.equal(new Set(HDRI_PRESETS.map((p) => p.id)).size, 15);
  for (const preset of HDRI_PRESETS) {
    const b = readFileSync(`public${preset.file}`);
    const data = parseRgbe(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    assert.ok(data.width >= 512);
    assert.ok(data.rgb.every(Number.isFinite));
    assert.ok(existsSync(`public/studio/hdri/lighting-${preset.id}.jpg`));
  }
});
