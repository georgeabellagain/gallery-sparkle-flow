import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionSnapshot } from "../src/lib/subscription-event";
const at = "2026-10-27T12:00:00.000Z";
const event = { id: "sub_1", customerId: "ctm_1", status: "active", customData: { userId: "550e8400-e29b-41d4-a716-446655440000" }, items: [{ price: { importMeta: { externalId: "personal_monthly" } }, product: { importMeta: { externalId: "personal" } } }] };
test("cancellation-first carries all fields needed to create a subscription", () => {
  const row = subscriptionSnapshot(event, "live", at, true);
  assert.equal(row.status, "canceled");
  assert.equal(row.current_period_end, at);
  assert.equal(row.user_id, event.customData.userId);
  assert.equal(row.price_id, "personal_monthly");
  assert.equal(row.cancel_at_period_end, false);
});
test("scheduled cancellation retains paid period and environment", () => {
  const row = subscriptionSnapshot({ ...event, scheduledChange: { action: "cancel" }, currentBillingPeriod: { startsAt: at, endsAt: "2026-11-27T12:00:00.000Z" } }, "sandbox", at);
  assert.equal(row.cancel_at_period_end, true);
  assert.equal(row.current_period_end, "2026-11-27T12:00:00.000Z");
  assert.equal(row.environment, "sandbox");
});
test("incomplete identity and invalid event timestamps fail instead of acknowledging a lost purchase", () => {
  assert.throws(() => subscriptionSnapshot({ ...event, customData: {} }, "live", at));
  assert.throws(() => subscriptionSnapshot({ ...event, items: [] }, "live", at));
  assert.throws(() => subscriptionSnapshot(event, "live", "invalid"));
});
