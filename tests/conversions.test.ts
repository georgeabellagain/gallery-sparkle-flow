import test from "node:test";
import assert from "node:assert/strict";
import { isNewAccount, subscriptionValue } from "../src/lib/conversions";

test("a sign-up is counted only on a brand-new account's first sign-in", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  assert.equal(isNewAccount({ created_at: "2026-10-18T11:58:00Z" }, now), true);
  assert.equal(isNewAccount({ created_at: "2026-10-18T11:30:00Z" }, now), false, "an older account signing in again");
  assert.equal(isNewAccount({ created_at: "2026-09-01T00:00:00Z" }, now), false);
  assert.equal(isNewAccount({}, now), false);
});

test("subscription conversions carry the plan's price", () => {
  assert.equal(subscriptionValue("personal_yearly"), 25);
  assert.equal(subscriptionValue("personal_monthly"), 3);
});