import { test } from "node:test";
import assert from "node:assert/strict";
import { backdropCoverage } from "../src/lib/portfolia/backdrop-coverage";

test("photograph covers zoom-out and pan in either direction without reaching its edges", () => {
  for (const aspect of [.5, 1, 2]) for (const view of [1, 2, 4]) for (const x of [-2, 0, 2]) for (const y of [-1, 0, 1]) {
    const scale = backdropCoverage(2, aspect, view, x, y);
    assert.ok(2 * scale > view + 2 * Math.abs(y));
    assert.ok(2 * aspect * scale > view * aspect + 2 * Math.abs(x));
  }
});
