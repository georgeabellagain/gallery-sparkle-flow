import test from "node:test";
import assert from "node:assert/strict";
import { MONTHLY_BILLING, YEARLY_BILLING, YEARLY_PER_MONTH } from "../src/lib/portfolia/plans";

test("labels £3 as monthly billing", () => {
  assert.equal(MONTHLY_BILLING, "£3/month, billed monthly");
});

test("labels £2.08 as the equivalent of £25 billed yearly", () => {
  assert.equal(YEARLY_PER_MONTH, "£2.08");
  assert.equal(YEARLY_BILLING, "£25 billed yearly (£2.08/month equivalent)");
});
