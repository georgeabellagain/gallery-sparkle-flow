import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDensity } from "../src/lib/portfolia/resolution";

test("parallel density checks retain the full sample and highest native image detail", async () => {
  let active = 0, peak = 0;
  const seen: number[] = [];
  const ops = { save: 1, restore: 2, transform: 3, paintImageXObject: 4, paintInlineImageXObject: 5, paintImageMaskXObject: 6, paintFormXObjectBegin: 7, paintFormXObjectEnd: 8 };
  const doc = {
    numPages: 6,
    async getPage(n: number) {
      return {
        getViewport: () => ({ width: 100, height: 100 }),
        async getOperatorList() {
          seen.push(n); peak = Math.max(peak, ++active);
          await new Promise(resolve => setImmediate(resolve));
          active--;
          return { fnArray: [ops.transform, ops.paintImageXObject], argsArray: [[100, 0, 0, 100, 0, 0], [null, n * 100, 100]] };
        },
      };
    },
  };
  assert.equal(await detectDensity(doc, ops), 6);
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(peak, 2);
});
