import { test } from "node:test";
import assert from "node:assert/strict";
import { STICKERS, STICKER_SIZE, placeSticker, readablePageStickers, stickersForPage, validatePageSticker, type PageSticker } from "../src/lib/portfolia/page-extras";
import { moveToPage, transformExtra } from "../src/lib/portfolia/scrapbook-transform";

const base: PageSticker = { id: "s1", page: 2, half: "right", sticker: "arrow-right", colour: "#e8604c", x: 0.4, y: 0.4, size: 0.12 };

test("stickers are validated like any page extra", () => {
  assert.equal(validatePageSticker(base, 4), null);
  assert.ok(validatePageSticker({ ...base, sticker: "nope" as PageSticker["sticker"] }, 4));
  assert.ok(validatePageSticker({ ...base, page: 9 }, 4));
  assert.ok(validatePageSticker({ ...base, colour: "red" }, 4));
  assert.ok(validatePageSticker({ ...base, x: 0.95 }, 4), "kept on the page");
  assert.equal(readablePageStickers([base, { ...base }, { ...base, id: "s2", size: 9 }], 4).length, 1, "duplicates and bad ones are dropped");
  assert.ok(STICKERS.length >= 12);
});

test("a sticker stays square and on its page when moved or resized", () => {
  const moved = placeSticker(base, 2, -1, base.size);
  assert.ok(moved.x + moved.size <= 1 && moved.y >= 0);
  const big = transformExtra("stickers", base, 0.9, 0, "se", 1.4) as PageSticker;
  assert.equal(big.size, STICKER_SIZE.max);
  // On a spread-sheet page it is mapped onto its half of the full page.
  assert.deepEqual(stickersForPage([base], 2, true)[0]!.x, 0.5 + base.x / 2);
});

test("dropping an item over the other page moves it there, kept on that page", () => {
  const across = moveToPage("stickers", base, 1, "left", 1.05, 1.4) as PageSticker;
  assert.equal(across.page, 1);
  assert.equal(across.half, "left");
  assert.ok(across.x + across.size <= 1.0001 && across.x >= 0.8);
});
