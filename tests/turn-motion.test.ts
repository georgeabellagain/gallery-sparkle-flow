import { test } from "node:test";
import assert from "node:assert/strict";
import { turnEase, turnClearance } from "../src/lib/portfolia/turn-motion";

test("turns settle without a discontinuous shadow offset in either direction", () => {
  assert.equal(turnClearance(0, .01), 0);
  assert.ok(Math.abs(turnClearance(1, .01)) < 1e-12);
  assert.equal(turnClearance(.5, .01), .01);
  for (const t of [.01, .1, .25, .49]) assert.ok(Math.abs(turnClearance(t, .01) - turnClearance(1-t, .01)) < 1e-12);
});
test("turn timing has gentle endpoints and advances monotonically", () => {
  assert.equal(turnEase(0), 0); assert.equal(turnEase(1), 1);
  assert.ok(turnEase(.01) < .0001);
  assert.ok(1 - turnEase(.99) < .0001);
  for (let i = 1; i <= 100; i++) assert.ok(turnEase(i/100) >= turnEase((i-1)/100));
});
