import test from "node:test";
import assert from "node:assert/strict";
import { PHOTO_SIZE_PRESETS, photoSizeError } from "../src/lib/portfolia/photo-export";

test("every preset exports its exact dimensions within the safety limits", () => {
  const ids = new Set<string>();
  for (const preset of PHOTO_SIZE_PRESETS) {
    assert.equal(photoSizeError(preset), null, preset.id);
    assert.equal(ids.has(preset.id), false);
    ids.add(preset.id);
  }
  assert.deepEqual(
    PHOTO_SIZE_PRESETS.find((p) => p.id === "amazon-tile"),
    { id: "amazon-tile", label: "Amazon A+ image tile", width: 600, height: 600 },
  );
});
test("custom sizes reject invalid input, excessive areas and GPU limits without silently resizing", () => {
  for (const width of [NaN, Infinity, -1, 0, 63, 100.5])
    assert.ok(photoSizeError({ width, height: 1080 }));
  assert.ok(photoSizeError({ width: 4000, height: 5000 }));
  assert.ok(photoSizeError({ width: 9000, height: 100 }));
  assert.ok(photoSizeError({ width: 2560, height: 1600 }, 2048));
  assert.equal(photoSizeError({ width: 4096, height: 4096 }), null);
  assert.equal(photoSizeError({ width: 3200, height: 1800 }), null);
  assert.equal(photoSizeError({ width: 1800, height: 3200 }), null);
});
