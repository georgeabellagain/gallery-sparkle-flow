import test from "node:test";
import assert from "node:assert/strict";
import { canShareVideo, shareCaption, shareLink, SOCIAL_NETWORKS, videoComposer } from "../src/lib/portfolia/social-share";
import { deletionBlocked } from "../src/lib/account.functions";
import { accountExport } from "../src/lib/portfolia/data-export";
import { reportHref } from "../src/lib/portfolia/report";

const url = "https://portfolia.site/p/ab12c";

test("social share links carry the portfolio link, encoded, to each network", () => {
  const caption = shareCaption("Ana & Co", url);
  assert.ok(caption.includes(url));
  for (const { id } of SOCIAL_NETWORKS) {
    const href = shareLink(id, url, caption, "https://portfolia.site/cover.jpg");
    assert.ok(href.includes(encodeURIComponent(url)), id);
    assert.ok(!href.includes("Ana & Co"), `${id} encodes the text`);
    assert.ok(/^(https:|mailto:)/.test(href));
  }
  assert.ok(shareLink("linkedin", url, caption).startsWith("https://www.linkedin.com/sharing/share-offsite/?url="));
  assert.ok(shareLink("facebook", url, caption).startsWith("https://www.facebook.com/sharer/sharer.php?u="));
  assert.ok(videoComposer("linkedin", caption).includes("shareActive=true"));
});

test("video sharing uses the share sheet only where files can be shared", () => {
  const file = { name: "v.mp4" } as unknown as File;
  assert.equal(canShareVideo(file, undefined), false);
  assert.equal(canShareVideo(file, {} as Navigator), false);
  assert.equal(canShareVideo(file, { canShare: () => true } as unknown as Navigator), true);
  assert.equal(canShareVideo(file, { canShare: () => { throw new Error("no"); } } as unknown as Navigator), false);
});

test("an account with a renewing plan cannot be deleted", () => {
  assert.equal(deletionBlocked(null), false);
  assert.equal(deletionBlocked({ status: "active", cancel_at_period_end: false }), true);
  assert.equal(deletionBlocked({ status: "past_due", cancel_at_period_end: null }), true);
  assert.equal(deletionBlocked({ status: "active", cancel_at_period_end: true }), false);
  assert.equal(deletionBlocked({ status: "canceled", cancel_at_period_end: false }), false);
});

test("data export lists every portfolio with its statistics", () => {
  const portfolio = { code: "a1", profile: { name: "A", links: [] } } as any, other = { code: "b2", profile: { name: "B", links: [] } } as any;
  const doc = { portfolio, analytics: { visits: [1], downloads: [] }, others: [{ portfolio: other, analytics: { visits: [], downloads: [2] } }], account: { signedIn: true } } as any;
  const data = accountExport(doc, "me@example.com", new Date("2026-10-18T00:00:00Z"));
  assert.equal(data.account.email, "me@example.com");
  assert.deepEqual(data.portfolios.map(p => p.code), ["a1", "b2"]);
  assert.deepEqual(data.portfolios[1]!.analytics.downloads, [2]);
});

test("the report link names the portfolio being reported", () => {
  const href = reportHref(url);
  assert.ok(href.startsWith("mailto:hello@portfolia.site?"));
  assert.ok(decodeURIComponent(href).includes(url));
});
