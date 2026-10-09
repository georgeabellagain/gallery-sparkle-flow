import { test } from "node:test";
import assert from "node:assert/strict";
import { readerSlideOffset, READER_SLIDE_MS } from "../src/lib/portfolia/reader-slide";

test("forward and backward slides stay bounded and land exactly at centre", () => {
  for (const direction of [1, -1] as const) {
    assert.equal(readerSlideOffset(-100, 800, direction), direction * 96);
    assert.equal(readerSlideOffset(READER_SLIDE_MS, 800, direction), 0);
    assert.equal(readerSlideOffset(READER_SLIDE_MS + 1000, 800, direction), 0);
    let previous = 96;
    for (let elapsed = 0; elapsed <= READER_SLIDE_MS; elapsed += 7) {
      const offset = Math.abs(readerSlideOffset(elapsed, 800, direction));
      assert.ok(offset <= previous && offset >= 0);
      previous = offset;
    }
  }
});
test("the DOM and GPU offsets scale identically without changing page dimensions", () => {
  const pixels = readerSlideOffset(140, 1000, 1);
  const world = readerSlideOffset(140, 2.3, 1);
  assert.ok(Math.abs(world - pixels * 2.3 / 1000) < 1e-12);
  assert.equal(readerSlideOffset(100, 0, 1), 0);
});
