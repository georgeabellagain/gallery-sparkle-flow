import { test } from "node:test";
import assert from "node:assert/strict";
import { cropMediaBox, mediaCropInsets, mediaClipPath, validMediaCrop } from "../src/lib/portfolia/media-crop";
import { PINK_ANIMATION_PLACEMENT } from "../src/lib/portfolia/pink-animation-placement";
import { validatePageSticker } from "../src/lib/portfolia/page-extras";

test("crop insets clip the positioned media, without stretching it or moving its source", () => {
  const box = { x: -.25, y: .25, width: .5, height: 1 };
  const crop = { left: .25, right: .25, top: .125, bottom: .25 };
  assert.deepEqual(cropMediaBox(box, crop), { x: -.125, y: .375, width: .25, height: .625 });
  assert.equal(mediaClipPath(crop), "inset(12.5% 25% 25% 25%)");
  assert.deepEqual(mediaCropInsets(crop), [.125, .25, .25, .25]);
  assert.equal(validMediaCrop({ top: Infinity }), false);
  assert.equal(validMediaCrop({ right: .5 }), false);
});

test("all prepared Pink overlays validate as separate placements, including both on page 4", () => {
  assert.deepEqual(PINK_ANIMATION_PLACEMENT.map(p => p.page), [1, 4, 4, 5, 10, 11, 20, 21]);
  for (const p of PINK_ANIMATION_PLACEMENT) {
    assert.equal(validatePageSticker({ ...p, id: p.name, half: "right", sticker: "animation", colour: "#1c1c1c", image: { key: "anim_test" } }, 24), null);
  }
});
