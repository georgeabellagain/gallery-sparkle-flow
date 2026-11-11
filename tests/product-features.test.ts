import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import {
  MAX_EXTRAS, extraKindFor, isMissingColumn, productCoverPath, productExtraPath, productSlug, publicProduct,
  saveProductSchema, slugFromTitle, stampText, type Product,
} from "../src/lib/products/model";
import { customerSession, newAccessToken, tokenHash } from "../src/lib/products/access.server";
import { safeFileName, serveProductCover, serveProductFile } from "../src/lib/products/file.server";
import { findPublishedProduct } from "../src/lib/products/lookup.server";
import { PRODUCT_EVENT_KINDS, zeroFilledDays } from "../src/lib/products/stats.server";
import { cleanStamp, stampPdf } from "../src/lib/products/stamp";
import { STAMP_SERVER_LIMIT_BYTES, autoDelivery, extrasTotalBytes } from "../src/lib/products/plan";
import { MAX_DELIVERY_BODY, cleanEmail, deliveryKeyValid, handleDeliveryRequest, issueOrderLink, revokeOrder, shopifyHmacValid } from "../src/lib/products/delivery.server";
import { isBotAgent } from "../src/lib/portfolia/open-notify";

const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222", linkId = "33333333-3333-4333-8333-333333333333";
const pdfPath = (n: string) => `${owner}/${id}/${n}.pdf`;
const extraId = "66666666-6666-4666-8666-666666666666";
const base = {
  id, owner_id: owner, title: "Zine", description: "", buy_url: "", status: "published", allow_download: true,
  full_file: { path: pdfPath("44444444-4444-4444-8444-444444444444"), name: "private.pdf", bytes: 1000, pages: 9 },
  preview_file: { path: pdfPath("55555555-5555-4555-8555-555555555555"), name: "preview.pdf", bytes: 500, pages: 3 },
  preview_pages: [1, 2, 3], appearance: { mode: "book", look: "clean" }, revision: 2, updated_at: "2026-11-11",
  cover_file: { path: `${owner}/${id}/77777777-7777-4777-8777-777777777777.webp`, width: 480, height: 600, bytes: 20000 },
  extra_files: [{ id: extraId, path: `${owner}/${id}/${extraId}.zip`, name: "Printables <pack>.zip", bytes: 300, kind: "zip" as const }],
} as unknown as Product & { owner_id: string };
const grant = { id: linkId, product_id: id, secret: newAccessToken(), revoked: false, expires_at: null as string | null, stamp: null as string | null };

/** A small stand-in for the Supabase client: one row per table, filters by eq(), records what was signed and written. */
function db(rows: Record<string, any> = {}, opts: { rpc?: (name: string, args: any) => any } = {}) {
  const signed: string[] = [], inserts: any[] = [], updates: any[] = [], rpcs: any[] = [];
  const client: any = {
    signed, inserts, updates, rpcs,
    rpc: async (name: string, args: any) => { rpcs.push([name, args]); return opts.rpc ? opts.rpc(name, args) : { data: true, error: null }; },
    from(table: string) {
      const f: Record<string, unknown> = {};
      const row = () => rows[table];
      const match = (r: any) => r && Object.entries(f).every(([k, v]) => r[k] === v);
      const q: any = {
        select: () => q, eq: (k: string, v: unknown) => { f[k] = v; return q; }, in: () => q, gte: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => {
          const r = row();
          if (r && r.__error) return { data: null, error: r.__error };
          return { data: match(r) ? r : null, error: null };
        },
        single: async () => (q.__insert ? q.__insert : { data: row(), error: null }),
        insert(v: any) { inserts.push([table, v]); const r = rows[`${table}:insert`]; q.__insert = r ?? { data: { id: `${table}-id`, ...v }, error: null }; return q; },
        update(v: any) { updates.push([table, v]); return q; },
        then(resolve: any) { return resolve({ data: row() ? [row()] : [], error: null, count: rows[`${table}:count`] ?? 0 }); },
      };
      return q;
    },
    storage: { from: () => ({ createSignedUrl: async (p: string) => { signed.push(p); return { data: { signedUrl: "https://storage.test/x" }, error: null }; } }) },
  };
  return client;
}
const req = (q: string, h?: Record<string, string>) => new Request(`https://portfolia.site/api/public/product-file/${id}?${q}`, { headers: h });
const fetchOk = (async () => new Response("bytes", { headers: { "Content-Length": "5" } })) as typeof fetch;

/* ---------- A: covers ---------- */
test("cover paths belong to this owner and product and are WebP", () => {
  assert.ok(productCoverPath(owner, id, base.cover_file!.path));
  for (const p of [base.cover_file!.path.replace(owner, id), base.cover_file!.path.replace(`/${id}/`, `/${owner}/`), `${owner}/${id}/../x.webp`, base.cover_file!.path.replace(".webp", ".png")])
    assert.equal(productCoverPath(owner, id, p), false, p);
});
test("public product carries a cover URL, never the storage path", () => {
  const json = JSON.stringify(publicProduct(base, false));
  assert.match(json, /\/api\/public\/product-cover\/11111111-1111-4111-8111-111111111111\?v=2/);
  assert.ok(!json.includes(base.cover_file!.path));
  assert.equal(publicProduct({ ...base, cover_file: null }, false).coverUrl, null);
});
test("draft covers are not served and nothing is signed", async () => {
  const d = db({ digital_products: { ...base, status: "draft" } });
  assert.equal((await serveProductCover(d, id, fetchOk)).status, 404);
  assert.equal(d.signed.length, 0);
  const live = db({ digital_products: base });
  const res = await serveProductCover(live, id, fetchOk);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "image/webp");
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("Location"), null, "proxied, not redirected");
});
test("migrations cap covers at 300 KB and allow only the listed types", () => {
  const a = readFileSync("supabase/migrations/20261111120000_product_covers.sql", "utf8");
  assert.ok(a.includes("307200") && a.includes("\\.(pdf|webp)$"));
  const e = readFileSync("supabase/migrations/20261111120400_product_extras.sql", "utf8");
  assert.ok(e.includes("(pdf|webp|zip|epub|png|jpg|mp3|txt)"));
  for (const bad of ["html", "svg", "js", "exe"]) assert.ok(!new RegExp(`[|(]${bad}[|)]`).test(e), bad);
  for (const f of ["20261111120000_product_covers", "20261111120100_product_slugs", "20261111120200_product_stats", "20261111120300_product_link_stamps", "20261111120400_product_extras", "20261111120500_product_orders"]) {
    const sql = readFileSync(`supabase/migrations/${f}.sql`, "utf8").trim();
    assert.ok(sql.startsWith("BEGIN;") && sql.endsWith("COMMIT;"), f);
  }
});

/* ---------- B: addresses ---------- */
test("addresses accept plain words and refuse reserved words, ids and bad shapes", () => {
  for (const ok of ["my-zine", "pink", "a1b", "Summer-Lookbook-2026"]) assert.ok(productSlug.safeParse(ok).success, ok);
  for (const bad of ["ab", "-zine", "zine-", "my zine", "a".repeat(41), "embed", "products", "api", id, id.replace(/-/g, ""), "zíne"])
    assert.equal(productSlug.safeParse(bad).success, false, bad);
  for (const title of ["My Zine!", "Été à Paris", "  ", "API", "x", "A very long title that keeps going past forty characters easily"]) {
    const s = slugFromTitle(title);
    assert.ok(s === "" || productSlug.safeParse(s).success, `${title} -> ${s}`);
  }
  assert.equal(slugFromTitle("My Zine!"), "my-zine");
});
test("an address finds only a published product, and before the migration finds nothing", async () => {
  assert.equal((await findPublishedProduct(db({ digital_products: { ...base, slug: "my-zine" } }), "my-zine")).row?.id, id);
  assert.equal((await findPublishedProduct(db({ digital_products: { ...base, slug: "my-zine", status: "draft" } }), "my-zine")).row, null);
  const old = db({ digital_products: { __error: { code: "42703", message: "column digital_products.slug does not exist" } } });
  assert.deepEqual(await findPublishedProduct(old, "my-zine"), { row: null, error: null });
  assert.ok(isMissingColumn({ code: "PGRST204" }) && !isMissingColumn({ code: "23505" }));
});
test("the embed and the preview never become a customer edition", () => {
  const page = readFileSync("src/routes/embed.product.$id.tsx", "utf8");
  assert.match(page, /previewOnly: true/);
  const fns = readFileSync("src/lib/products/functions.ts", "utf8");
  assert.match(fns, /data\.previewOnly \? null : await customerLink/);
  const shopper = publicProduct(base, false);
  assert.equal(shopper.customer, false);
  assert.ok(shopper.fileUrl?.includes("edition=preview"));
  assert.match(readFileSync("src/server.ts", "utf8"), /startsWith\("\/embed\/"\)/, "every /embed/ path may be framed");
});

/* ---------- C: statistics ---------- */
test("statistics are zero-filled to exactly 30 days in order, counts only", () => {
  const now = new Date("2026-11-11T10:00:00Z");
  const days = zeroFilledDays([{ day: "2026-11-11", kind: "preview_view", count: 3 }, { day: "2026-10-13", kind: "buy_click", count: 1 }, { day: "2026-10-01", kind: "preview_view", count: 9 }, { day: "2026-11-10", kind: "evil", count: 5 }], now);
  assert.equal(days.length, 30);
  assert.equal(days[0]!.day, "2026-10-13");
  assert.equal(days[29]!.day, "2026-11-11");
  assert.equal(days[29]!.preview_view, 3);
  assert.equal(days[0]!.buy_click, 1);
  assert.deepEqual(Object.keys(days[0]!).sort(), ["buy_click", "customer_open", "day", "download", "preview_view"]);
  assert.deepEqual([...PRODUCT_EVENT_KINDS], ["preview_view", "buy_click", "customer_open", "download"]);
});
test("bots are not counted and the public endpoint accepts only views and buy clicks", () => {
  for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "curl/8", "", null]) assert.ok(isBotAgent(ua));
  assert.ok(!isBotAgent("Mozilla/5.0 (iPhone) Safari"));
  assert.match(readFileSync("src/lib/products/stats.functions.ts", "utf8"), /kind: z\.enum\(\["preview_view", "buy_click"\]\)/);
  const sql = readFileSync("supabase/migrations/20261111120200_product_stats.sql", "utf8");
  assert.match(sql, /CHECK \(kind IN \('preview_view','buy_click','customer_open','download'\)\)/);
  assert.ok(!/\b(ip|user_agent|referrer|cookie|visitor)\b/i.test(sql.replace(/--.*$/gm, "")), "the table holds counts only");
});
test("downloads are counted once, not per range request", async () => {
  const session = customerSession(grant);
  const first = db({ digital_products: base, product_access_links: grant });
  await serveProductFile(first, id, req("edition=customer&download=1", { Range: "bytes=0-99" }), session, fetchOk);
  assert.deepEqual(first.rpcs.map((r: any) => r[1].event_kind), ["download"]);
  const later = db({ digital_products: base, product_access_links: grant });
  await serveProductFile(later, id, req("edition=customer&download=1", { Range: "bytes=100-199" }), session, fetchOk);
  assert.equal(later.rpcs.length, 0);
});

/* ---------- D: stamps ---------- */
test("stamping keeps every page and records the buyer in the Subject", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([300, 400]);
  const out = await stampPdf(await doc.save(), "Jane Smith · order 1042 — ✓");
  const back = await PDFDocument.load(out);
  assert.equal(back.getPageCount(), 3);
  assert.equal(back.getSubject(), cleanStamp("Licensed to Jane Smith · order 1042 — ✓"));
  assert.ok(/^[\x20-\x7e]+$/.test(back.getSubject() ?? ""));
});
test("the stamp field refuses long text and control characters", () => {
  assert.ok(stampText.safeParse("Jane Smith").success);
  assert.equal(stampText.safeParse("x".repeat(81)).success, false);
  assert.equal(stampText.safeParse("Jane\nSmith").success, false);
  assert.equal(stampText.safeParse("Jane\u0007").success, false);
});
test("a stamped link never downloads an unstamped file", async () => {
  const stamped = { ...grant, stamp: "Jane" }, session = customerSession(stamped);
  const big = db({ digital_products: { ...base, full_file: { ...base.full_file!, bytes: STAMP_SERVER_LIMIT_BYTES + 1 } }, product_access_links: stamped });
  assert.equal((await serveProductFile(big, id, req("edition=customer&download=1"), session, fetchOk)).status, 404);
  assert.equal(big.signed.length, 0);
  const damaged = db({ digital_products: base, product_access_links: stamped });
  assert.equal((await serveProductFile(damaged, id, req("edition=customer&download=1"), session, fetchOk)).status, 422, "not a PDF: refused, not passed through");
  // Reading online is unchanged.
  const reading = db({ digital_products: base, product_access_links: stamped });
  assert.equal((await serveProductFile(reading, id, req("edition=customer"), session, fetchOk)).status, 200);
  assert.equal(publicProduct(base, true, { stamp: "Jane" }).stamp, "Jane");
  assert.equal(publicProduct(base, false, { stamp: "Jane" }).stamp, null);
});

/* ---------- E: extras ---------- */
test("extra files: kinds, paths and the limit of five", () => {
  assert.equal(extraKindFor("pack.ZIP"), "zip");
  assert.equal(extraKindFor("photo.jpeg"), "jpg");
  for (const bad of ["page.svg", "index.html", "app.js", "setup.exe", "film.mp4", "noext"]) assert.equal(extraKindFor(bad), null, bad);
  assert.ok(productExtraPath(owner, id, base.extra_files![0]!.path, "zip"));
  assert.equal(productExtraPath(owner, id, base.extra_files![0]!.path, "png"), false);
  assert.equal(productExtraPath(owner, id, `${owner}/${id}/../${extraId}.zip`, "zip"), false);
  const six = Array.from({ length: MAX_EXTRAS + 1 }, (_, i) => ({ ...base.extra_files![0]!, id: `6666666${i}-6666-4666-8666-666666666666` }));
  assert.equal(saveProductSchema.safeParse({ ...base, extra_files: six }).success, false);
  assert.equal(extrasTotalBytes("personal"), 200 * 1048576);
});
test("shoppers learn only how many extras there are", () => {
  const shopper = publicProduct(base, false), json = JSON.stringify(shopper);
  assert.deepEqual(shopper.extras, []);
  assert.equal(shopper.extrasCount, 1);
  assert.ok(!json.includes("Printables") && !json.includes(base.extra_files![0]!.path));
  const customer = publicProduct(base, true);
  assert.equal(customer.extras[0]!.name, "Printables <pack>.zip");
  assert.ok(!JSON.stringify(customer).includes(base.extra_files![0]!.path));
});
test("extras need a customer session and are always attachments", async () => {
  const none = db({ digital_products: base, product_access_links: grant });
  assert.equal((await serveProductFile(none, id, req(`extra=${extraId}`), undefined, fetchOk)).status, 404);
  assert.equal(none.signed.length, 0);
  const ok = db({ digital_products: base, product_access_links: grant });
  const res = await serveProductFile(ok, id, req(`extra=${extraId}`), customerSession(grant), fetchOk);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/octet-stream");
  assert.equal(res.headers.get("Content-Disposition"), 'attachment; filename="Printables_pack_.zip"');
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("Content-Security-Policy"), "sandbox");
  const draft = db({ digital_products: { ...base, status: "draft" }, product_access_links: grant });
  assert.equal((await serveProductFile(draft, id, req(`extra=${extraId}`), customerSession(grant), fetchOk)).status, 404);
  assert.equal(safeFileName("../../evil.html", "txt"), "evil.html.txt");
});

/* ---------- F: automatic delivery ---------- */
const business = { plan: async () => "business" as const };
function deliveryDb(extra: Record<string, any> = {}) {
  return db({ digital_products: { ...base, delivery: { source: "generic", key_hash: "", settings: {} } }, product_orders: { id: "order-1", buyer_email: "jane@example.com" }, ...extra });
}
test("the same order twice sends one email and makes one link", async () => {
  const sent: any[] = [];
  const deps = { ...business, send: async (m: any) => { sent.push(m); } };
  const first = deliveryDb();
  assert.equal((await issueOrderLink(first, id, { source: "manual", orderRef: "1042", email: " Jane@Example.com ", name: "Jane" }, deps)).status, "sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "jane@example.com");
  assert.match(sent[0].link, /#access=[\w-]{43}$/);
  assert.equal(sent[0].idempotencyKey, `delivery:${id}:manual:1042`);
  const linkInsert = first.inserts.find((i: any) => i[0] === "product_access_links")[1];
  assert.equal(linkInsert.stamp, "Jane");
  assert.ok(!JSON.stringify(first.inserts).includes(sent[0].link.split("#access=")[1]), "the token itself is never stored");
  const again = deliveryDb({ "product_orders:insert": { data: null, error: { code: "23505" } } });
  assert.equal((await issueOrderLink(again, id, { source: "manual", orderRef: "1042", email: "jane@example.com" }, deps)).status, "duplicate");
  assert.equal(sent.length, 1);
  assert.ok(!again.inserts.some((i: any) => i[0] === "product_access_links"));
});
test("drafts and plans without delivery are refused", async () => {
  const deps = { plan: async () => "personal" as const, send: async () => {} };
  await assert.rejects(issueOrderLink(deliveryDb(), id, { source: "manual", orderRef: "1", email: "a@b.co" }, deps));
  await assert.rejects(issueOrderLink(db({ digital_products: { ...base, status: "draft" } }), id, { source: "manual", orderRef: "1", email: "a@b.co" }, { ...business, send: async () => {} }));
  assert.ok(autoDelivery("business") && !autoDelivery("personal") && !autoDelivery("free"));
  assert.equal(cleanEmail("not an email"), null);
});
test("the endpoint checks keys and signatures, and never answers with a token", async () => {
  const key = newAccessToken();
  const deps = { ...business, send: async () => {} };
  const generic = () => deliveryDb({ digital_products: { ...base, delivery: { source: "generic", key_hash: tokenHash(key), settings: {} } } });
  const post = (headers: Record<string, string>, body: string, source = "generic", query = "") =>
    new Request(`https://portfolia.site/api/public/product-delivery/${id}/${source}${query}`, { method: "POST", headers, body });
  const body = JSON.stringify({ order_id: "77", email: "buyer@example.com" });
  const bad = generic();
  assert.equal((await handleDeliveryRequest(bad, id, "generic", post({ Authorization: `Bearer ${newAccessToken()}` }, body), deps)).status, 401);
  assert.equal(bad.inserts.length, 0);
  const good = await handleDeliveryRequest(generic(), id, "generic", post({ Authorization: `Bearer ${key}` }, body), deps);
  assert.equal(good.status, 200);
  assert.equal(good.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await good.json(), { ok: true });
  assert.equal((await handleDeliveryRequest(generic(), id, "generic", post({ Authorization: `Bearer ${key}` }, "x".repeat(MAX_DELIVERY_BODY + 1)), deps)).status, 413);
  assert.equal((await handleDeliveryRequest(db({ digital_products: { ...base, status: "draft" } }), id, "generic", post({ Authorization: `Bearer ${key}` }, body), deps)).status, 404);
  assert.ok(deliveryKeyValid(tokenHash(key), key) && !deliveryKeyValid(tokenHash(key), "short"));

  // Shopify: the signature covers the raw body; the same JSON re-serialised fails.
  const secret = "shpss_test", raw = '{"id": 900, "email":"s@example.com","line_items":[{"product_id":123}]}';
  const sig = createHmac("sha256", secret).update(raw).digest("base64");
  assert.ok(shopifyHmacValid(new TextEncoder().encode(raw), sig, secret));
  assert.equal(shopifyHmacValid(new TextEncoder().encode(JSON.stringify(JSON.parse(raw))), sig, secret), false);
  const shop = () => deliveryDb({ digital_products: { ...base, delivery: { source: "shopify", key_hash: tokenHash(key), settings: { secret, shopifyProduct: "123" } } } });
  const wrong = shop();
  assert.equal((await handleDeliveryRequest(wrong, id, "shopify", post({ "X-Shopify-Hmac-Sha256": "AAAA", "X-Shopify-Topic": "orders/paid" }, raw, "shopify"), deps)).status, 401);
  assert.equal(wrong.inserts.length, 0);
  const right = shop();
  assert.equal((await handleDeliveryRequest(right, id, "shopify", post({ "X-Shopify-Hmac-Sha256": sig, "X-Shopify-Topic": "orders/paid" }, raw, "shopify"), deps)).status, 200);
  assert.ok(right.inserts.some((i: any) => i[0] === "product_orders" && i[1].order_ref === "900"));
});
test("a refund switches the order's link off", async () => {
  const d = db({ product_orders: { id: "order-1", link_id: linkId, product_id: id, source: "gumroad", order_ref: "S1" } });
  assert.equal(await revokeOrder(d, id, { source: "gumroad", orderRef: "S1" }), true);
  assert.ok(d.updates.some((u: any) => u[0] === "product_access_links" && u[1].revoked === true));
  assert.ok(d.updates.some((u: any) => u[0] === "product_orders" && u[1].refunded_at));
});
test("owner order lists never include token hashes or secrets", () => {
  const src = readFileSync("src/lib/products/delivery.functions.ts", "utf8");
  const select = /from\("product_orders"\)\s*\.select\("([^"]+)"\)/.exec(src)![1]!;
  assert.ok(!/token|secret|key/.test(select));
  assert.match(src, /hasSecret: Boolean/);
  assert.match(readFileSync("src/lib/products/functions.ts", "utf8"), /const \{ delivery: _delivery, \.\.\.product \} = row/);
});
