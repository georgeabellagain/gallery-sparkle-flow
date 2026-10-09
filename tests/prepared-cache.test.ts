import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreparedCache } from "../src/lib/portfolia/prepared-cache";

test("prefetch and navigation share one preparation, then reuse the completed result", async () => {
  const cache = createPreparedCache<string, { bytes: number; content: string }>(100, value => value.bytes);
  let renders = 0, finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const render = async () => { renders++; await gate; return { bytes: 40, content: "HD page with text and links" }; };
  const prefetch = cache.load("page-2", render);
  const navigation = cache.load("page-2", render);
  assert.equal(prefetch, navigation);
  finish();
  const page = await navigation;
  assert.equal(await cache.load("page-2", render), page);
  assert.equal(renders, 1);
  assert.deepEqual(cache.stats(), { bytes: 40, entries: 1, pending: 0 });
});
test("a revisited page survives eviction and oversized pages remain readable", async () => {
  const cache = createPreparedCache<string, number>(100, value => value);
  await cache.load("first", async () => 40);
  await cache.load("second", async () => 40);
  cache.get("first");
  await cache.load("third", async () => 40);
  assert.equal(cache.get("second"), undefined);
  assert.equal(cache.get("first"), 40);
  assert.equal(await cache.load("oversized", async () => 200), 200);
  assert.equal(cache.get("oversized"), undefined);
  assert.equal(cache.stats().bytes, 80);
});
test("failed preparation can retry, and different resolutions cannot share results", async () => {
  const cache = createPreparedCache<string, number>(100, value => value);
  await assert.rejects(cache.load("page:1000", async () => { throw new Error("PDF unavailable"); }));
  assert.equal(cache.stats().pending, 0);
  assert.equal(await cache.load("page:1000", async () => 20), 20);
  assert.equal(await cache.load("page:2000", async () => 60), 60);
  assert.equal(cache.get("page:1000"), 20);
  assert.equal(cache.get("page:2000"), 60);
});
