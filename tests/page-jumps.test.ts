import { test } from "node:test";
import assert from "node:assert/strict";
import { jumpsForLeaf, jumpsForPage, placeJump, readablePageJumps, validatePageJump, type PageJump } from "../src/lib/portfolia/page-extras";
import { transformExtra } from "../src/lib/portfolia/scrapbook-transform";

const jump = (patch: Partial<PageJump> = {}): PageJump => ({ id: "jump_1", page: 2, half: "left", x: 0.1, y: 0.2, width: 0.8, height: 0.05, target: 7, ...patch });

test("a contents link needs a real page to go to and a box on its page", () => {
  assert.equal(validatePageJump(jump(), 16), null);
  assert.ok(validatePageJump(jump({ target: 0 }), 16));
  assert.ok(validatePageJump(jump({ target: 17 }), 16));
  assert.ok(validatePageJump(jump({ target: 2.5 }), 16));
  assert.ok(validatePageJump(jump({ x: 0.5 }), 16), "box runs off the page");
  assert.ok(validatePageJump(jump({ height: 0.001 }), 16));
});

test("readable contents links drop broken ones", () => {
  assert.equal(readablePageJumps([jump(), jump({ id: "b", target: 40 }), jump()], 16).length, 1);
});

test("boxes move and resize freely but stay on the page", () => {
  const moved = transformExtra("jumps", jump(), 0.5, 0.9, "move", 1.4) as PageJump;
  assert.ok(moved.x + moved.width <= 1 + 1e-9 && moved.y + moved.height <= 1 + 1e-9);
  const resized = transformExtra("jumps", jump(), -0.3, 0.02, "se", 1.4) as PageJump;
  assert.ok(Math.abs(resized.width - 0.5) < 1e-9 && Math.abs(resized.height - 0.07) < 1e-9);
  assert.equal(placeJump(jump(), 0, 0, 0, 0).width, 0.02);
});

test("on a spread sheet the right half's links map onto the full page", () => {
  const j = jump({ half: "right", x: 0.2, width: 0.6 });
  assert.deepEqual(jumpsForPage([j], 2, true)[0], { ...j, x: 0.6, width: 0.3 });
  assert.equal(jumpsForLeaf([j], { page: 2, half: "left" }).length, 0);
});
