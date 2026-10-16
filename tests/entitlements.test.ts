import test from "node:test";
import assert from "node:assert/strict";
import { ownerHasPersonal } from "../src/lib/portfolia/entitlements.server";
import { publicAssetKeys, publicPortfolioPlan } from "../src/lib/portfolia/public-assets";
import { servePortfolioFile } from "../src/lib/portfolia/file.server";
import type { Portfolio } from "../src/lib/portfolia/store";

const now = Date.parse("2026-10-16T12:00:00Z");
function billingDb(sub: any, error: any = null) {
  const calls: unknown[] = [];
  const q: any = { select: () => q, eq: (...args: unknown[]) => { calls.push(args); return q; }, order: () => q, limit: () => q, maybeSingle: async () => ({ data: sub, error }) };
  return { from: (name: string) => { assert.equal(name, "subscriptions"); return q; }, calls };
}
test("verified billing scopes to the owner and live environment; lifecycle and price decide access", async () => {
  for (const [status, end, price, expected] of [
    ["active", null, "personal_monthly", true], ["trialing", null, "personal_yearly", true],
    ["past_due", null, "personal_monthly", true], ["paused", null, "personal_monthly", false],
    ["canceled", "2026-10-17T12:00:00Z", "personal_yearly", true],
    ["canceled", "2026-10-15T12:00:00Z", "personal_yearly", false],
    ["canceled", "invalid", "personal_yearly", false], ["active", null, "other_product", false],
  ]) {
    const db = billingDb({ status, current_period_end: end, price_id: price });
    assert.equal(await ownerHasPersonal("owner", db, now), expected);
    assert.deepEqual(db.calls, [["user_id", "owner"], ["environment", "live"]]);
  }
  assert.equal(await ownerHasPersonal("owner", billingDb(null), now), false);
  await assert.rejects(ownerHasPersonal("owner", billingDb(null, { message: "offline" }), now));
});
const portfolio = { plan: "personal", pdf: { blobKey: "pdf_book", pages: 2 }, profile: { cv: { blobKey: "private_cv" }, photoKey: "photo" }, style: { bannerKey: "banner" } } as Portfolio;
test("forged portfolio plan cannot grant CV/banner assets and public metadata uses verified plan", () => {
  assert.deepEqual(publicAssetKeys(portfolio, false).sort(), ["pdf_book", "photo"]);
  assert.ok(publicAssetKeys({ ...portfolio, plan: "free" }, true).includes("private_cv"));
  const free = publicPortfolioPlan(portfolio, false);
  assert.equal(free.plan, "free"); assert.equal(free.profile.cv, undefined); assert.equal(free.style?.bannerKey, undefined);
  assert.ok(!publicAssetKeys({ ...portfolio, pdf: { ...portfolio.pdf!, blobKey: "private_cv" } }, false).includes("private_cv"));
});
test("file endpoint rechecks billing for a CV before every storage download, failing closed", async () => {
  let sub: any = null, error: any = null, downloads = 0;
  const db: any = { from: (table: string) => {
    if (table === "subscriptions") return billingDb(sub, error).from(table);
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { owner_id: "owner", data: portfolio }, error: null }) }; return q;
  }, storage: { from: () => ({ download: async () => { downloads++; return { data: new Blob(["cv"]), error: null }; } }) } };
  const check = async () => ({ state: "open" as const, policy: null });
  const url = "https://portfolia.site/api/public/portfolio-file/book?asset=private_cv";
  assert.equal((await servePortfolioFile("book", url, db, check)).status, 404); assert.equal(downloads, 0);
  sub = { status: "active", price_id: "personal_monthly" };
  assert.equal((await servePortfolioFile("book", url, db, check)).status, 200); assert.equal(downloads, 1);
  sub = { status: "canceled", price_id: "personal_monthly", current_period_end: "2000-01-01" };
  assert.equal((await servePortfolioFile("book", url, db, check)).status, 404); assert.equal(downloads, 1);
  error = { message: "database down" };
  assert.equal((await servePortfolioFile("book", url, db, check)).status, 503); assert.equal(downloads, 1);
});
