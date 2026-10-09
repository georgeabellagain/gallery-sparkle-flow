import test from "node:test";
import assert from "node:assert/strict";
import { portfolioHead } from "../src/lib/portfolia/head";
import { migrateDraftFiles } from "../src/lib/portfolia/sync-files";
import { createVisitorSession } from "../src/lib/portfolia/visitor-storage";
import type { Portfolio } from "../src/lib/portfolia/store";

const portfolio = { code: "book", status: "published", plan: "personal", username: "Designer", searchIndexing: true, profile: { name: "A designer", title: "Illustrator", intro: "My work" }, pdf: { blobKey: "pdf_example", coverKey: "pdf_example_cover.jpg" } } as Portfolio;
const meta = (head: ReturnType<typeof portfolioHead>, name: string) => head.meta.find(item => "name" in item && item.name === name)?.content;
test("public portfolio variants share the personal canonical and cover image", () => {
  const head = portfolioHead({ portfolio, urls: {} }, "Portfolio");
  assert.equal(head.links[0].href, "https://portfolia.site/designer");
  assert.equal(meta(head, "robots"), "index, follow");
  assert.match(String(meta(head, "twitter:image")), /portfolio-cover\/book/);
});
test("preview URLs and unlisted portfolios are never indexable", () => {
  assert.equal(meta(portfolioHead({ portfolio, urls: {} }, "Portfolio", true), "robots"), "noindex, nofollow");
  const unlisted = { ...portfolio, plan: "free" as const, searchIndexing: false };
  const head = portfolioHead({ portfolio: unlisted, urls: {} }, "Portfolio");
  assert.equal(head.links[0].href, "https://portfolia.site/p/book");
  assert.equal(meta(head, "robots"), "noindex, nofollow");
});
test("old portfolios without generated covers have a working generic social image", () => {
  const old = { ...portfolio, pdf: { ...portfolio.pdf!, coverKey: undefined } };
  assert.equal(meta(portfolioHead({ portfolio: old, urls: {} }, "Portfolio"), "twitter:image"), "https://portfolia.site/og-image.jpg");
});
test("draft migration rejects a failed upload and retries all referenced files", async () => {
  const files = ["pdf", "cover", "photo"];
  const attempts: string[] = [];
  const read = async () => new Blob(["asset"]);
  await assert.rejects(migrateDraftFiles(files, read, async key => {
    attempts.push(key); if (key === "cover") throw new Error("Offline");
  }), /Offline/);
  assert.deepEqual(attempts, ["pdf", "cover"]);
  attempts.length = 0;
  await migrateDraftFiles([...files, "pdf"], read, async key => { attempts.push(key); });
  assert.deepEqual(attempts, files);
});
test("missing browser files cannot be silently published as saved", async () => {
  let uploaded = false;
  await assert.rejects(migrateDraftFiles(["pdf"], async () => undefined, async () => { uploaded = true; }), /missing/);
  assert.equal(uploaded, false);
});
test("blocked storage cannot crash a visit or duplicate tracking in one session", () => {
  const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } };
  const session = createVisitorSession(() => "temporary-visitor");
  assert.equal(session.firstVisit("book", blocked), true);
  assert.equal(session.firstVisit("book", blocked), false);
  assert.equal(session.firstVisit("other", blocked), true);
  assert.equal(session.visitor(blocked), "temporary-visitor");
  assert.equal(session.visitor(blocked), "temporary-visitor");
});
test("existing storage identifiers and session visits remain deduplicated", () => {
  const entries = new Map([["portfolia.vid", "existing"], ["portfolia.session.book", "1"]]);
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  const session = createVisitorSession(() => "new");
  assert.equal(session.visitor(storage), "existing");
  assert.equal(session.firstVisit("book", storage), false);
  assert.equal(session.firstVisit("new-book", storage), true);
  assert.equal(entries.get("portfolia.session.new-book"), "1");
});
