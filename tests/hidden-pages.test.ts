import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestVisible, readableHiddenPages, stepVisible, visiblePageList, visiblePosition } from "../src/lib/portfolia/hidden-pages";
import { bookLayout } from "../src/lib/portfolia/book-layout";
import { coverThenSpreads } from "../src/lib/portfolia/mixed-layout";
import { formatPageList, parsePageList } from "../src/components/pf/HiddenPagesSettings";

test("hidden pages are tidied and at least one page always stays visible", () => {
  assert.deepEqual(readableHiddenPages([5, 2, 2, 0, 9, 1.5, "3"], 6), [2, 5]);
  assert.deepEqual(readableHiddenPages([1, 2, 3], 3), [1, 2]);
  assert.deepEqual(readableHiddenPages([1], 1), []);
  assert.deepEqual(readableHiddenPages("2", 4), []);
});

test("readers step over hidden pages, and links to them open the nearest visible page", () => {
  const visible = visiblePageList(8, new Set([3, 4, 8]));
  assert.deepEqual(visible, [1, 2, 5, 6, 7]);
  assert.equal(nearestVisible(3, visible), 5);
  assert.equal(nearestVisible(8, visible), 7, "after the last visible page, the last one");
  assert.equal(stepVisible(2, 1, visible), 5);
  assert.equal(stepVisible(5, -1, visible), 2);
  assert.equal(stepVisible(7, 1, visible), 7);
  assert.equal(visiblePosition(5, visible), 3);
});

test("the book leaves hidden pages out of its sheets", () => {
  const book = bookLayout(6, false, [1, 2, 5, 6]);
  assert.deepEqual(book.leaves.map((l) => l.page), [1, 2, 5, 6]);
  assert.deepEqual(book.spreads, [[null, 0], [1, 2], [3, null]]);
  const spreads = bookLayout(4, true, [1, 3]);
  assert.deepEqual(spreads.leaves.map((l) => `${l.page}${l.half}`), ["1left", "1right", "3left", "3right"]);
  const mixed = coverThenSpreads(4, [1, 2, 4]);
  assert.deepEqual(mixed.leaves.map((l) => l.page), [1, 2, 2, 4, 4]);
  assert.deepEqual(bookLayout(3, false), bookLayout(3, false, [1, 2, 3]), "no list means every page");
});

test("pages can be typed as a list with ranges", () => {
  assert.deepEqual(parsePageList("2, 5-7 9–8, 40, x", 10), [2, 5, 6, 7, 8, 9]);
  assert.equal(formatPageList([2, 5, 6, 7, 9]), "2, 5–7, 9");
  assert.equal(formatPageList([]), "");
});

test("stickers drawn on turning paper move through the same loops as on the page", async () => {
  const { stickerPose } = await import("../src/components/pf/sticker-layer");
  assert.deepEqual(stickerPose("bounce", 0), { dy: 0 });
  assert.equal(stickerPose("bounce", 0.6).dy, 0.14, "halfway through its 1.2 s loop it is at the bottom");
  assert.equal(Math.round(stickerPose("spin", 3).rotate!), 180);
  assert.equal(stickerPose("flash", 1).alpha, 0.35);
  assert.deepEqual(stickerPose("unknown", 1), {});
});
