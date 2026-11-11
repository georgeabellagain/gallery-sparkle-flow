import test from "node:test";
import assert from "node:assert/strict";
import { STYLE_PRESETS, presetPatch } from "../src/lib/portfolia/style-presets";
import { DEFAULT_VIEWER } from "../src/lib/portfolia/store";
import { buyButtonLabel, previewPages, productAppearance, productListing, samplePages, shopUrlProblem } from "../src/lib/products/model";

test("the Buy button uses the seller's wording and price, or the default", () => {
  assert.equal(buyButtonLabel({}), "Buy the full product");
  assert.equal(buyButtonLabel({ price: "£6" }), "Buy the full product · £6");
  assert.equal(buyButtonLabel({ buyLabel: "Buy on Etsy", price: "£6" }), "Buy on Etsy · £6");
});

test("listing words are plain text, trimmed and capped; empty values are not stored", () => {
  const saved = productAppearance.parse({ mode: "book", look: "clean", price: "  £6 ", buyLabel: "", seller: "Small Stories Press" });
  assert.equal(saved.price, "£6");
  assert.equal(saved.buyLabel, undefined);
  assert.equal(saved.seller, "Small Stories Press");
  assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", price: "x".repeat(25) }));
  assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", seller: "a\nb" }));
  // Whatever is stored, the public page shows text only.
  assert.deepEqual(productListing({ price: " £6\u0007 ", buyLabel: 3, seller: "x".repeat(90) }), { price: "£6", buyLabel: undefined, seller: "x".repeat(60) });
  assert.deepEqual(productListing(null), { price: undefined, buyLabel: undefined, seller: undefined });
});

test("readers always keep the flipbook; auto-flip stays within sensible speeds", () => {
  assert.deepEqual(productAppearance.parse({ mode: "book", look: "clean", modes: ["book", "scroll"] }).modes, ["book", "scroll"]);
  assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", modes: ["scroll"] }));
  assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", modes: [] }));
  assert.equal(productAppearance.parse({ mode: "book", look: "clean", autoFlip: 5 }).autoFlip, 5);
  for (const bad of [0, 1, 31]) assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", autoFlip: bad }));
});

test("every ready-made look, and the animated scenes, can be saved on a product", () => {
  for (const preset of STYLE_PRESETS) {
    const result = productAppearance.safeParse({ ...DEFAULT_VIEWER, ...presetPatch(preset, DEFAULT_VIEWER), mode: "book" });
    assert.ok(result.success, `${preset.id}: ${result.success ? "" : result.error.issues[0]?.message}`);
  }
  assert.equal(productAppearance.parse({ mode: "book", look: "clean", backgroundPreset: "scene:sorbet" }).backgroundPreset, "scene:sorbet");
  assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", backgroundPreset: "https://example.com/x.jpg" }));
  assert.equal(productAppearance.parse({ mode: "book", look: "clean", idleOrbit: "idle" }).idleOrbit, "idle");
});

test("a shop link is checked as it is typed", () => {
  assert.equal(shopUrlProblem(""), "");
  assert.equal(shopUrlProblem("https://www.etsy.com/listing/123"), "");
  for (const bad of ["etsy.com/listing/1", "http://shop.test", "javascript:alert(1)"]) assert.notEqual(shopUrlProblem(bad), "");
});

test("the sample quick pick is always a valid preview selection", () => {
  for (const total of [1, 2, 3, 7, 24, 400, 2000]) {
    const pages = samplePages(total);
    assert.ok(pages.includes(1) && pages.length <= 7 && pages.every((n) => n >= 1 && n <= total), `total ${total}`);
    assert.deepEqual(previewPages(pages.join(", "), total), pages);
  }
  assert.deepEqual(samplePages(24), [1, 6, 7, 12, 13, 18, 19]);
});
