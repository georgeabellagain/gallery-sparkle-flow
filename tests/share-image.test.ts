import test from "node:test";
import assert from "node:assert/strict";
import { shareImageKey, shareImageUrl } from "../src/lib/portfolia/share-image";
import { portfolioHead } from "../src/lib/portfolia/head";
import type { Portfolio } from "../src/lib/portfolia/store";

const portfolio = (extra = {}): Portfolio => ({ status: "published", code: "example", profile: { name: "George", title: "Designer", intro: "", links: [], email: "" }, pdf: { blobKey: "pdf_abc123", coverKey: "pdf_abc123_cover.jpg", name: "work.pdf", pages: 2, bytes: 123, uploadedAt: 1 }, ...extra }) as Portfolio;

test("published cover uses a stable versioned HTTPS URL and large-card metadata", () => {
  const p = portfolio();
  const image = shareImageUrl(p);
  assert.equal(image, "https://portfolia.site/api/public/portfolio-cover/example?v=pdf_abc123_cover.jpg");
  const { meta } = portfolioHead({ portfolio: p, urls: {} }, "Portfolio");
  assert.ok(meta.some((m) => "property" in m && m.property === "og:image" && m.content === image));
  assert.ok(meta.some((m) => "name" in m && m.name === "twitter:card" && m.content === "summary_large_image"));
  assert.ok(meta.some((m) => "name" in m && m.name === "robots" && m.content === "noindex, nofollow"));
});

test("unpublished, missing and legacy portfolios cannot expose a cover", () => {
  assert.equal(shareImageKey(undefined), undefined);
  assert.equal(shareImageKey(portfolio({ status: "draft" })), undefined);
  const p = portfolio();
  delete p.pdf.coverKey;
  assert.equal(shareImageUrl(p), undefined);
  assert.ok(!portfolioHead({ portfolio: p, urls: {} }, "Portfolio").meta.some((m) => "property" in m && m.property === "og:image"));
});

test("replacing the PDF invalidates its previous cover and changes the share URL", () => {
  const p = portfolio();
  const oldUrl = shareImageUrl(p);
  p.pdf.blobKey = "pdf_replacement";
  assert.equal(shareImageKey(p), undefined);
  p.pdf.coverKey = "pdf_replacement_cover.jpg";
  assert.notEqual(shareImageUrl(p), oldUrl);
});

test("arbitrary file references and traversal cannot become public preview paths", () => {
  for (const key of ["../another-owner/photo", "pdf_abc123", "photo_private", "pdf_abc123/../../secret"]) {
    const p = portfolio();
    p.pdf.coverKey = key;
    assert.equal(shareImageKey(p), undefined);
  }
  const p = portfolio();
  p.pdf.blobKey = "../pdf_secret";
  p.pdf.coverKey = "../pdf_secret_cover.jpg";
  assert.equal(shareImageKey(p), undefined);
});

import { servePortfolioCover } from "../src/lib/portfolia/cover.server";

test("cover endpoint checks publication before private storage and never caches", async () => {
  let published = true;
  let downloaded = "";
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ eq: (_column: string, status: string) => {
      assert.equal(status, "published");
      return { maybeSingle: async () => ({ data: published ? { owner_id: "owner", data: portfolio() } : null, error: null }) };
    } }) }) }),
    storage: { from: () => ({ download: async (path: string) => { downloaded = path; return { data: new Blob(["jpeg"]), error: null }; } }) },
  } as unknown as Parameters<typeof servePortfolioCover>[2];
  const url = shareImageUrl(portfolio())!;
  const response = await servePortfolioCover("example", url, db);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(downloaded, "owner/pdf_abc123_cover.jpg");
  downloaded = "";
  assert.equal((await servePortfolioCover("example", url.replace("abc123", "obsolete"), db)).status, 404);
  assert.equal(downloaded, "");
  published = false;
  assert.equal((await servePortfolioCover("example", url, db)).status, 404);
  assert.equal(downloaded, "");
});
