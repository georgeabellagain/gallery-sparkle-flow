import { test } from "node:test";
import assert from "node:assert/strict";
import { readerTextureEvictions } from "../src/lib/portfolia/render-budget";

test("reader cache evicts oldest offscreen textures and keeps recently viewed pages warm", () => {
  const textures = Array.from({ length: 10 }, (_, id) => ({ id, visible: id === 0, usedAt: id }));
  assert.deepEqual(readerTextureEvictions(textures).map(t => t.id), [1, 2]);
  assert.deepEqual(textures.map(t => t.id), Array.from({ length: 10 }, (_, i) => i));
  assert.deepEqual(readerTextureEvictions(textures.slice(0, 8)), []);
});
test("visible pages are preserved even when they exceed the warm-cache limit", () => {
  const visible = Array.from({ length: 10 }, (_, usedAt) => ({ visible: true, usedAt }));
  const offscreen = { visible: false, usedAt: 100 };
  assert.deepEqual(readerTextureEvictions([...visible, offscreen]), [offscreen]);
});
