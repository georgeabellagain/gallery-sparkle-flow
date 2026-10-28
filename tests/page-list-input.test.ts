import test from "node:test";
import assert from "node:assert/strict";
import { parsePageList, formatPageList } from "../src/components/pf/HiddenPagesSettings";
test("hidden-page ranges accept spaces, en dashes, reversed ranges and duplicates", () => {
  assert.deepEqual(parsePageList("2 - 5, 8 – 7, 3", 10), [2,3,4,5,7,8]);
  assert.deepEqual(parsePageList("0 - 3, 9-100, nope", 10), [1,2,3,9,10]);
  assert.equal(formatPageList([2,3,4,7,9,10]), "2–4, 7, 9–10");
});
