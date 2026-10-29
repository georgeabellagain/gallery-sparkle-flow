import test from "node:test";
import assert from "node:assert/strict";
import { ownerHasBusiness, ownerPlan } from "../src/lib/portfolia/entitlements.server";
import { isBusinessPrice, isPaidPrice, isYearlyPrice, priceFor, priceValue } from "../src/lib/portfolia/plan-prices";
import { readableGa4Id, readableLeadRecipients } from "../src/lib/portfolia/business";
import { maxPortfolios, uploadLimitMb, type Doc } from "../src/lib/portfolia/store";

const now = Date.parse("2026-10-29T12:00:00Z");
function billingDb(sub: any) {
  const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: sub, error: null }) };
  return { from: () => q };
}

test("plan prices: Business counts as paid, billing period and value come from the price", () => {
  assert.equal(priceFor("business", "year"), "business_yearly");
  assert.equal(priceFor("personal", "month"), "personal_monthly");
  assert.ok(isPaidPrice("business_monthly") && isPaidPrice("personal_yearly") && !isPaidPrice("other_product") && !isPaidPrice(null));
  assert.ok(isBusinessPrice("business_yearly") && !isBusinessPrice("personal_yearly"));
  assert.ok(isYearlyPrice("business_yearly") && !isYearlyPrice("business_monthly"));
  assert.deepEqual(["personal_monthly", "personal_yearly", "business_monthly", "business_yearly"].map(priceValue), [3, 25, 12, 99]);
});

test("owner plan reads the live subscription: Business price, lifecycle and grace", async () => {
  for (const [status, end, price, expected] of [
    ["active", null, "business_monthly", "business"], ["past_due", null, "business_yearly", "business"],
    ["active", null, "personal_monthly", "personal"], ["paused", null, "business_monthly", "free"],
    ["canceled", "2026-10-30T12:00:00Z", "business_yearly", "business"], ["canceled", "2026-10-28T12:00:00Z", "business_yearly", "free"],
    ["active", null, "other_product", "free"],
  ] as const) {
    assert.equal(await ownerPlan("owner", billingDb({ status, current_period_end: end, price_id: price }), now), expected);
  }
  assert.equal(await ownerPlan("owner", billingDb(null), now), "free");
  assert.equal(await ownerHasBusiness("owner", billingDb({ status: "active", price_id: "personal_yearly" }), now), false);
});

test("GA4 IDs and team lead addresses are tidied and capped", () => {
  assert.equal(readableGa4Id(" g-abc123xyz "), "G-ABC123XYZ");
  for (const bad of ["UA-12345-1", "G-", "G-<script>", 42, undefined]) assert.equal(readableGa4Id(bad), undefined);
  assert.deepEqual(readableLeadRecipients([" A@Studio.com ", "a@studio.com", "nope", "b@x.co", 3]), ["a@studio.com", "b@x.co"]);
  assert.equal(readableLeadRecipients(Array.from({ length: 9 }, (_, i) => `t${i}@x.co`)).length, 5);
  assert.deepEqual(readableLeadRecipients("a@x.co"), []);
});

test("portfolio count and upload size follow the plan", () => {
  const doc = (plan: "free" | "personal", tier?: "business") => ({ portfolio: { plan, tier }, others: [] }) as unknown as Doc;
  assert.deepEqual([doc("free"), doc("personal"), doc("personal", "business")].map(maxPortfolios), [1, 10, 50]);
  assert.deepEqual([doc("free"), doc("personal"), doc("personal", "business")].map(uploadLimitMb), [30, 100, 250]);
});
