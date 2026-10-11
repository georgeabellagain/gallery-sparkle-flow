import { test } from "node:test";
import assert from "node:assert/strict";
import { featureArtworkReady } from "../src/lib/portfolia/feature-artwork";

test("website links needs its displayed page only, never the unprepared page 9", () => {
  assert.equal(featureArtworkReady("links", {8: "page8"}), true);
  assert.equal(featureArtworkReady("links", {9: "page9"}), false);
});
test("multi-page animations wait for every displayed page", () => {
  assert.equal(featureArtworkReady("paged", {4: "a", 5: "b", 7: "d"}), false);
  assert.equal(featureArtworkReady("scroll", {5: "a", 6: "b", 7: "c", 8: "d"}), true);
  assert.equal(featureArtworkReady("share", {12: "a"}), false);
  assert.equal(featureArtworkReady("share", {12: "a", 13: "b"}), true);
});
