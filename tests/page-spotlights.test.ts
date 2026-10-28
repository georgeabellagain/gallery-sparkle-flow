import { test } from "node:test";
import assert from "node:assert/strict";
import { placeSpotlight, readablePageSpotlights, SPOTLIGHT_LIMITS, SPOTLIGHT_SIZE, spotlightRegion, spotlightsForLeaf, spotlightsForPage, validatePageSpotlight, type PageSpotlight } from "../src/lib/portfolia/page-extras";
import { transformExtra } from "../src/lib/portfolia/scrapbook-transform";
import { publicPortfolioPlan } from "../src/lib/portfolia/public-assets";
import type { Portfolio } from "../src/lib/portfolia/store";

const spot = (patch: Partial<PageSpotlight> = {}): PageSpotlight => ({ id: "spot_1", page: 2, half: "left", x: 0.2, y: 0.3, width: 0.4, height: 0.25, ...patch });

test("a spotlight on the page is valid, with or without a caption", () => {
  assert.equal(validatePageSpotlight(spot(), 5), null);
  assert.equal(validatePageSpotlight(spot({ caption: "Hand-stitched binding" }), 5), null);
});

test("spotlights off the page, too small, or with long captions are refused", () => {
  assert.ok(validatePageSpotlight(spot({ page: 6 }), 5));
  assert.ok(validatePageSpotlight(spot({ x: 0.8 }), 5));
  assert.ok(validatePageSpotlight(spot({ width: 0.01 }), 5));
  assert.ok(validatePageSpotlight(spot({ caption: "x".repeat(141) }), 5));
  assert.ok(validatePageSpotlight(spot({ half: "middle" as "left" }), 5));
  assert.ok(validatePageSpotlight(spot({ id: "bad id!" }), 5));
});

test("readable spotlights drop invalid and duplicate ones and stop at the Personal limit", () => {
  const many = Array.from({ length: 30 }, (_, i) => spot({ id: `s${i}` }));
  assert.equal(readablePageSpotlights(many, 5).length, SPOTLIGHT_LIMITS.personal);
  assert.equal(readablePageSpotlights([spot(), spot(), spot({ id: "x", page: 9 })], 5).length, 1);
  assert.deepEqual(readablePageSpotlights("nope", 5), []);
});

test("placing keeps the box on the page at its minimum size", () => {
  const moved = placeSpotlight(spot(), 0.9, -0.2, 0.4, 0.25);
  assert.equal(moved.x, 0.6);
  assert.equal(moved.y, 0);
  const tiny = placeSpotlight(spot(), 0.1, 0.1, 0, 0);
  assert.equal(tiny.width, SPOTLIGHT_SIZE.min);
  assert.equal(tiny.height, SPOTLIGHT_SIZE.min);
});

test("the corner handle resizes width and height freely; moving keeps the size", () => {
  const s = spot();
  const resized = transformExtra("spotlights", s, 0.1, 0.2, "se", 1.4) as PageSpotlight;
  assert.ok(Math.abs(resized.width - 0.5) < 1e-9 && Math.abs(resized.height - 0.45) < 1e-9);
  const moved = transformExtra("spotlights", s, 0.05, 0.05, "move", 1.4) as PageSpotlight;
  assert.equal(moved.width, s.width);
  assert.ok(Math.abs(moved.x - 0.25) < 1e-9);
});

test("a spotlight on a spread sheet's right half maps onto the full PDF page", () => {
  const s = spot({ half: "right", x: 0.2, width: 0.4 });
  assert.deepEqual(spotlightRegion(s, true), { x: 0.6, y: 0.3, width: 0.2, height: 0.25 });
  assert.deepEqual(spotlightRegion(s, false), { x: 0.2, y: 0.3, width: 0.4, height: 0.25 });
  assert.deepEqual(spotlightsForPage([s], 2, true)[0], { ...s, x: 0.6, width: 0.2 });
  assert.equal(spotlightsForLeaf([s], { page: 2, half: "left" }).length, 0);
  assert.equal(spotlightsForLeaf([s], { page: 2 }).length, 1);
});

test("a free owner's public portfolio keeps only the first few spotlights", () => {
  const spotlights = Array.from({ length: 5 }, (_, i) => spot({ id: `s${i}` }));
  const p = { code: "abc", profile: { links: [] }, pdf: { blobKey: "k", name: "a.pdf", bytes: 1, pages: 5, uploadedAt: 0, spotlights } } as unknown as Portfolio;
  assert.equal(publicPortfolioPlan(p, false).pdf?.spotlights?.length, SPOTLIGHT_LIMITS.free);
  assert.equal(publicPortfolioPlan(p, true).pdf?.spotlights?.length, 5);
});

test("magnifier customisation validates without invalidating existing spotlights", () => {
  assert.equal(validatePageSpotlight(spot({ iconX: 0, iconY: 1, iconScale: 3, hideIcon: true }), 5), null);
  for (const patch of [{ iconX: -0.1 }, { iconY: Infinity }, { iconScale: 0 }, { iconScale: 3.1 }, { hideIcon: "yes" }]) {
    assert.ok(validatePageSpotlight(spot(patch as Partial<PageSpotlight>), 5));
  }
  const s = spot({ iconX: 0.3, iconY: 0.7, iconScale: 1.5, hideIcon: true });
  const moved = placeSpotlight(s, 0, 0, 0.5, 0.5);
  assert.equal(moved.iconX, 0.3);
  assert.equal(moved.hideIcon, true);
  assert.equal(spotlightsForPage([s], 2, true)[0].iconScale, 1.5);
});
