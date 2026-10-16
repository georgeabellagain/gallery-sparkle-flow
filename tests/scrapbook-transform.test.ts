import { test } from "node:test";
import assert from "node:assert/strict";
import { transformExtra } from "../src/lib/portfolia/scrapbook-transform";
import { type Foldout, validateFoldout } from "../src/lib/portfolia/foldouts";
import {
  type PageLink,
  type PageTag,
  validatePageLink,
  validatePageTag,
} from "../src/lib/portfolia/page-extras";
import { tabSlot } from "../src/lib/portfolia/tab-geometry";
test("live note moves and all corner resizes remain on the page", () => {
  const note: Foldout = {
    id: "note",
    page: 1,
    half: "right",
    title: "Note",
    colour: "#ffffff",
    hinge: "top",
    x: 0.2,
    y: 0.2,
    width: 0.3,
    height: 0.3,
  };
  for (const handle of ["move", "nw", "ne", "sw", "se"] as const)
    for (const delta of [-2, 0.1, 2]) {
      const result = transformExtra("foldouts", note, delta, delta, handle, 1.4) as Foldout;
      assert.equal(validateFoldout(result, 3), null);
      assert.ok(result.x + result.width <= 1.00001);
      assert.ok(result.y + result.height <= 1.00001);
    }
});
test("live links resize and move with bounded dimensions and tabs scale on the edge", () => {
  const link: PageLink = {
    id: "link",
    page: 1,
    half: "right",
    url: "https://example.com/",
    x: 0.8,
    y: 0.8,
    size: 0.1,
  };
  for (const handle of ["move", "se"] as const)
    for (const delta of [-2, 2])
      assert.equal(
        validatePageLink(transformExtra("links", link, delta, delta, handle, 1.4) as PageLink, 3),
        null,
      );
  const tag: PageTag = { id: "tab", page: 1, label: "Page", colour: "#ffffff" };
  for (const handle of ["move", "se"] as const)
    for (const delta of [-2, 2]) {
      const next = transformExtra("tags", tag, delta, delta, handle, 1.4) as PageTag;
      assert.equal(validatePageTag(next, 3), null);
      const slot = tabSlot(1.4, 0, 1, next.position, next.scale);
      assert.ok(Math.abs(slot.y) + slot.height / 2 <= 0.7 + 1e-9);
    }
  assert.ok(tabSlot(1.4, 0, 1, 0.5, 2).height > tabSlot(1.4, 0, 1, 0.5, 1).height);
});
