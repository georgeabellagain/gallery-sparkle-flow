import { test } from "node:test";
import assert from "node:assert/strict";
import { backgroundPicture, BACKGROUND_PRESETS } from "../src/lib/portfolia/background-presets";

test("a selected bundled background resolves without an account upload", () => {
  assert.equal(backgroundPicture({backgroundPreset: 'wood_floor'}), '/studio/backgrounds/wood_floor.webp');
});
test("an upload takes precedence, including while its signed URL is loading", () => {
  assert.equal(backgroundPicture({backgroundPreset: 'wood_floor', backgroundKey: 'private-upload'}, 'blob:upload'), 'blob:upload');
  assert.equal(backgroundPicture({backgroundPreset: 'wood_floor', backgroundKey: 'private-upload'}), undefined);
});
test("custom preview URLs remain supported and invalid presets are ignored", () => {
  assert.equal(backgroundPicture({}, 'blob:custom'), 'blob:custom');
  assert.equal(backgroundPicture({backgroundPreset: 'unknown'}), undefined);
});

test("all bundled backgrounds have matching linear surface maps", async () => {
  const { backgroundSurfaceMaps } = await import("../src/lib/portfolia/background-presets");
  const { existsSync } = await import("node:fs");
  for (const preset of BACKGROUND_PRESETS) {
    const maps = backgroundSurfaceMaps(preset.url)!;
    assert.ok(maps);
    assert.ok(existsSync(`public${maps.normal}`));
    assert.ok(existsSync(`public${maps.roughness}`));
  }
  assert.equal(backgroundSurfaceMaps("blob:uploaded"), undefined);
});
