import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { productAnimationKey, productAnimationPath, productAppearance, productStickers, publicProduct, type Product, type ProductAnimation } from "../src/lib/products/model";
import { serveProductAnimation } from "../src/lib/products/file.server";
import { animationsShowing } from "../src/components/pf/sticker-layer";

const id = "11111111-1111-4111-8111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222",
  fileA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  fileB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const animation = (over: Partial<ProductAnimation> = {}): ProductAnimation => ({
  id: "anim_1", page: 4, half: "right", x: 0.1, y: 0.2, size: 0.3, play: "loop", name: "Waving fox",
  file: { path: `${owner}/${id}/${fileA}.webp`, bytes: 200_000, kind: "webp" }, ...over,
});
const product = (animations: ProductAnimation[], status = "published") => ({
  id, owner_id: owner, title: "Zine", description: "", buy_url: "", status, allow_download: true,
  full_file: { path: `${owner}/${id}/44444444-4444-4444-8444-444444444444.pdf`, name: "full.pdf", bytes: 1000, pages: 20 },
  preview_file: { path: `${owner}/${id}/55555555-5555-4555-8555-555555555555.pdf`, name: "preview.pdf", bytes: 500, pages: 3 },
  preview_pages: [1, 4, 5], appearance: { mode: "book", look: "clean", animations }, revision: 3, updated_at: "2026-11-12",
}) as unknown as Product & { owner_id: string };

test("customers get every animation; shoppers get those on preview pages, renumbered to the preview", () => {
  const list = [animation(), animation({ id: "anim_2", page: 9, file: { path: `${owner}/${id}/${fileB}.gif`, bytes: 900_000, kind: "gif" } }), animation({ id: "anim_3", page: 5, play: "tap", flip: true })];
  const full = productStickers(list, { total: 20 });
  assert.deepEqual(full.map((s) => [s.id, s.page]), [["anim_1", 4], ["anim_2", 9], ["anim_3", 5]]);
  const preview = productStickers(list, { preview: [1, 4, 5] });
  assert.deepEqual(preview.map((s) => [s.id, s.page]), [["anim_1", 2], ["anim_3", 3]]);
  assert.equal(preview[1]?.play, "tap");
  assert.equal(preview[1]?.flip, true);
  assert.equal(preview[0]?.image?.key, fileA);
  assert.equal(preview[0]?.sticker, "animation");
  assert.deepEqual(productStickers(list, { total: 6 }).map((s) => s.id), ["anim_1", "anim_3"], "pages the PDF doesn't have are left out");
  assert.deepEqual(productStickers("nonsense", { total: 20 }), []);
  assert.deepEqual(productStickers(undefined, { preview: [1] }), []);
});

test("what the public page receives never says where a picture is stored or who owns it", () => {
  for (const customer of [false, true]) {
    const json = JSON.stringify(publicProduct(product([animation()]), customer));
    assert.ok(!json.includes(owner), "owner id");
    assert.ok(!json.includes(".webp"), "storage path");
    assert.ok(json.includes(fileA), "the picture's public name");
  }
  assert.equal(publicProduct(product([animation({ page: 9 })]), false).animations.length, 0);
  assert.equal(publicProduct(product([animation({ page: 9 })]), true).animations.length, 1);
});

test("an animation is saved only with a plain record of an allowed picture", () => {
  const ok = productAppearance.parse({ mode: "book", look: "clean", animations: [animation()] });
  assert.equal(ok.animations?.[0]?.file.kind, "webp");
  const bad = (over: Record<string, unknown>) => () => productAppearance.parse({ mode: "book", look: "clean", animations: [{ ...animation(), ...over }] });
  assert.throws(bad({ file: { path: `${owner}/${id}/${fileA}.svg`, bytes: 10, kind: "svg" } }));
  assert.throws(bad({ file: { path: `${owner}/${id}/${fileA}.webp`, bytes: 3 * 1048576, kind: "webp" } }));
  assert.throws(bad({ size: 1.4 }));
  assert.throws(bad({ play: "always" }));
  assert.throws(bad({ name: "a\nb" }));
  assert.throws(() => productAppearance.parse({ mode: "book", look: "clean", animations: Array.from({ length: 51 }, (_, i) => animation({ id: `anim_${i}` })) }));
  assert.ok(productAnimationPath(owner, id, `${owner}/${id}/${fileA}.gif`, "gif"));
  for (const path of [`${id}/${id}/${fileA}.gif`, `${owner}/${owner}/${fileA}.gif`, `${owner}/${id}/../x.gif`, `${owner}/${id}/${fileA}.webp`, `${owner}/${id}/${fileA}.gif.html`])
    assert.equal(productAnimationPath(owner, id, path, "gif"), false, path);
  assert.equal(productAnimationKey(animation()), fileA);
});

function db(row: unknown) {
  const signed: string[] = [];
  const q: any = { select: () => q, eq: (k: string, v: unknown) => { if (k === "status" && (row as any)?.status !== v) q.miss = true; return q; }, maybeSingle: async () => ({ data: q.miss ? null : row, error: null }) };
  return { signed, from: () => { q.miss = false; return q; }, storage: { from: () => ({ createSignedUrl: async (path: string) => { signed.push(path); return { data: { signedUrl: "https://storage.test/x" }, error: null }; } }) } };
}
const picture = (async () => new Response("RIFFxxxxWEBP")) as typeof fetch;

test("only a published product's own saved animation pictures are served", async () => {
  const live = db(product([animation()]));
  const ok = await serveProductAnimation(live, id, fileA, picture);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("Content-Type"), "image/webp");
  assert.equal(ok.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(live.signed, [`${owner}/${id}/${fileA}.webp`]);
  for (const [row, file] of [
    [product([animation()], "draft"), fileA],
    [product([animation()]), fileB],
    [product([animation()]), "../../secret"],
    [product([animation()]), null],
    [product([animation({ file: { path: `${owner}/${id}/44444444-4444-4444-8444-444444444444.pdf`, bytes: 10, kind: "webp" } })]), "44444444-4444-4444-8444-444444444444"],
    [product([animation({ file: { path: `${id}/${id}/${fileA}.webp`, bytes: 10, kind: "webp" } })]), fileA],
  ] as const) {
    const mock = db(row);
    assert.equal((await serveProductAnimation(mock, id, file, picture)).status, 404);
    assert.equal(mock.signed.length, 0, "nothing is signed for a refused request");
  }
});

test("the database allows GIFs and 2 MB animation pictures, and nothing new that could run", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261112120000_product_animations.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("'image/gif'") && sql.includes("2097152"));
  assert.ok(!/svg|html|javascript/i.test(sql));
  assert.match(sql, /\\\.\(pdf\|webp\|gif\|zip\|epub\|png\|jpg\|mp3\|txt\)\$/);
});

test("a still page's animation layer is only drawn again when a frame has changed", () => {
  // Pictures not read yet show as -1: the layer waits rather than redrawing 30 times a second for nothing.
  const stickers = productStickers([animation()], { total: 20 });
  assert.equal(animationsShowing(stickers, 1), animationsShowing(stickers, 1.5));
  assert.equal(animationsShowing(stickers, 1), "-1");
});
