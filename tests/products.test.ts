import test from "node:test";
import assert from "node:assert/strict";
import {
  productFilePath,
  previewPages,
  publicProduct,
  saveProductSchema,
  shopUrl,
  type Product,
} from "../src/lib/products/model";
import {
  customerAccess,
  customerSession,
  newAccessToken,
  tokenHash,
  validProductLink,
} from "../src/lib/products/access.server";
import { serveProductFile } from "../src/lib/products/file.server";
const id = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222",
  linkId = "33333333-3333-4333-8333-333333333333";
const full = {
  path: `${owner}/${id}/44444444-4444-4444-8444-444444444444.pdf`,
  name: "private-original.pdf",
  bytes: 1000,
  pages: 50,
};
const preview = {
  ...full,
  path: `${owner}/${id}/55555555-5555-4555-8555-555555555555.pdf`,
  name: "preview.pdf",
  pages: 3,
};
const product = {
  id,
  owner_id: owner,
  title: "Zine",
  description: "Sample",
  buy_url: "https://www.etsy.com/listing/123",
  status: "published",
  full_file: full,
  preview_file: preview,
  preview_pages: [1, 4, 9],
  allow_download: true,
  appearance: { mode: "book", look: "clean" },
  revision: 1,
  updated_at: "2026-11-10",
} as Product & { owner_id: string };
const grant = {
  id: linkId,
  product_id: id,
  secret: newAccessToken(),
  revoked: false,
  expires_at: null as string | null,
};
function dbMock(row: any = product, link: any = grant) {
  const signed: string[] = [];
  return {
    signed,
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const q = {
        select() {
          return q;
        },
        eq(k: string, v: unknown) {
          filters[k] = v;
          return q;
        },
        async maybeSingle() {
          const data = table === "digital_products" ? row : link;
          return {
            data: data && Object.entries(filters).every(([k, v]) => data[k] === v) ? data : null,
            error: null,
          };
        },
      };
      return q;
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          signed.push(path);
          return { data: { signedUrl: "https://storage.test/file" }, error: null };
        },
      }),
    },
  };
}
const request = (query: string, headers?: Record<string, string>) =>
  new Request(`https://portfolia.site/api/public/product-file/${id}?${query}`, { headers });
const fetchPdf = (async () =>
  new Response("%PDF-test", { headers: { "Content-Length": "9" } })) as typeof fetch;
test("preview selection rejects invalid, excessive and out-of-range pages", () => {
  assert.deepEqual(previewPages("1, 3-5, 3", 10), [1, 3, 4, 5]);
  for (const value of ["0", "4-2", "11", "1-41", "1, NaN", "1.5"])
    assert.throws(() => previewPages(value, 50 === Number(value) ? 50 : 10));
});
test("public product metadata cannot reveal the original or access secrets", () => {
  const data = publicProduct(product, false);
  const json = JSON.stringify(data);
  assert.equal(data.pages, 3);
  assert.equal(data.allowDownload, false);
  assert.ok(!json.includes(full.path));
  assert.ok(!json.includes(full.name));
  assert.ok(!json.includes(owner));
  assert.ok(!json.includes("preview_pages"));
  assert.ok(data.fileUrl?.includes("edition=preview"));
});
test("file ownership rejects other products, owners and traversal", () => {
  assert.ok(productFilePath(owner, id, full.path));
  for (const path of [
    full.path.replace(owner, id),
    full.path.replace(id, owner),
    `${owner}/${id}/../secret.pdf`,
    `${owner}/${id}/evil.svg`,
  ])
    assert.equal(productFilePath(owner, id, path), false);
});
test("appearance schema excludes hidden pages, uploaded files and tracking", () => {
  const parsed = saveProductSchema.parse({
    ...product,
    appearance: {
      mode: "book",
      look: "studio",
      backgroundKey: "secret",
      hiddenPages: [2],
      ga4Id: "G-SECRET",
      backgroundColor: "#123456",
    },
  });
  assert.deepEqual(parsed.appearance, { mode: "book", look: "studio", backgroundColor: "#123456" });
});
test("shop URLs cannot execute code or include embedded credentials", () => {
  for (const value of [
    "javascript:alert(1)",
    "http://shop.test",
    "https://u:p@shop.test",
    "https://localhost/a",
    "https://127.0.0.1",
  ])
    assert.throws(() => shopUrl(value));
  assert.equal(shopUrl("https://www.etsy.com/listing/123"), "https://www.etsy.com/listing/123");
});
test("customer capabilities are random and only their hashes are persisted", () => {
  const a = newAccessToken(),
    b = newAccessToken();
  assert.match(a, /^[\w-]{43}$/);
  assert.notEqual(a, b);
  assert.match(tokenHash(a), /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash(a), a);
});
test("sessions are bound to product and link; revocation and expiry take effect immediately", async () => {
  const cookie = customerSession(grant);
  assert.equal(await customerAccess(dbMock(), id, cookie), true);
  assert.equal(await customerAccess(dbMock(), owner, cookie), false);
  assert.equal(await customerAccess(dbMock(), id, cookie + "0"), false);
  assert.equal(
    await customerAccess(dbMock(product, { ...grant, revoked: true }), id, cookie),
    false,
  );
  assert.equal(
    await customerAccess(dbMock(product, { ...grant, expires_at: "2000-01-01" }), id, cookie),
    false,
  );
  assert.equal(validProductLink({ ...grant, expires_at: "invalid" }), false);
});
test("unauthenticated original requests never sign storage files", async () => {
  const db = dbMock();
  const result = await serveProductFile(db, id, request("edition=customer"), undefined, fetchPdf);
  assert.equal(result.status, 404);
  assert.equal(db.signed.length, 0);
});
test("public preview signs only its separate file even with an injected asset parameter", async () => {
  const db = dbMock();
  const result = await serveProductFile(
    db,
    id,
    request(`edition=preview&asset=${encodeURIComponent(full.path)}`),
    undefined,
    fetchPdf,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(db.signed, [preview.path]);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(result.headers.get("Referrer-Policy"), "no-referrer");
});
test("download policy and draft state cannot be bypassed by changing URLs", async () => {
  for (const [row, query, cookie] of [
    [{ ...product, status: "draft" }, "edition=preview", undefined],
    [product, "edition=preview&download=1", undefined],
    [{ ...product, allow_download: false }, "edition=customer&download=1", customerSession(grant)],
  ] as const) {
    const db = dbMock(row);
    assert.equal((await serveProductFile(db, id, request(query), cookie, fetchPdf)).status, 404);
    assert.equal(db.signed.length, 0);
  }
});
test("authorized customer range requests proxy content without exposing the signed URL", async () => {
  const db = dbMock();
  let range = "";
  const result = await serveProductFile(
    db,
    id,
    request("edition=customer", { Range: "bytes=0-7" }),
    customerSession(grant),
    (async (_url, options) => {
      range = new Headers(options?.headers).get("Range") ?? "";
      return new Response("%PDF-1.7", {
        status: 206,
        headers: { "Content-Range": "bytes 0-7/1000", "Content-Length": "8" },
      });
    }) as typeof fetch,
  );
  assert.equal(result.status, 206);
  assert.equal(range, "bytes=0-7");
  assert.equal(result.headers.get("Location"), null);
  assert.equal(result.headers.get("Content-Range"), "bytes 0-7/1000");
  assert.deepEqual(db.signed, [full.path]);
});
test("revoked grants block subsequent file ranges", async () => {
  const db = dbMock(product, { ...grant, revoked: true });
  assert.equal(
    (
      await serveProductFile(
        db,
        id,
        request("edition=customer", { Range: "bytes=8-15" }),
        customerSession(grant),
        fetchPdf,
      )
    ).status,
    404,
  );
  assert.equal(db.signed.length, 0);
});
