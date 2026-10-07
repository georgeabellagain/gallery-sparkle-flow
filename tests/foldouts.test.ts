import test from "node:test";
import assert from "node:assert/strict";
import {
  fitFoldout,
  foldoutSurfaces,
  transformFoldout,
  foldoutKeys,
  foldoutsForLeaf,
  readableFoldouts,
  validateFoldout,
  type Foldout,
} from "../src/lib/portfolia/foldouts";
import { bookLayout } from "../src/lib/portfolia/book-layout";
import { servePortfolioFile } from "../src/lib/portfolia/file.server";
const item: Foldout = {
  id: "one",
  imageKey: "foldout_123",
  page: 2,
  half: "right",
  title: "Detail",
  hinge: "left",
  colour: "#d6dfd0",
  x: 0.55,
  y: 0.3,
  width: 0.32,
  height: 0.38,
};

test("fold-outs cannot escape a page or reference unsafe images", () => {
  assert.equal(validateFoldout(item, 4), null);
  for (const patch of [
    { page: 0 },
    { page: 5 },
    { page: 1.5 },
    { x: -0.1 },
    { y: 0.9 },
    { imageKey: "../private" },
    { imageKey: "https://other/image" },
    { width: NaN },
    { title: "" },
  ]) {
    assert.ok(validateFoldout({ ...item, ...patch }, 4));
  }
  assert.equal(
    readableFoldouts(
      [null, {}, item, item, { ...item, id: "off-page", page: 99 }],
      4,
    ).length,
    1,
  );
  assert.deepEqual(
    foldoutKeys({ pages: 4, foldouts: [item, { ...item, id: "two" }] }),
    ["foldout_123"],
  );
});
test("hinge and size changes retain closed notes within the page", () => {
  for (const hinge of ["left", "right"] as const)
    for (const width of [0.18, 0.32, 0.45])
      for (const x of [0, 0.5, 1]) {
        assert.equal(
          validateFoldout(fitFoldout({ ...item, hinge, width, x, y: 0.95 }), 4),
          null,
        );
      }
});
test("single pages and pre-arranged spreads show each fold-out exactly once", () => {
  for (const ready of [false, true]) {
    const { leaves } = bookLayout(4, ready);
    const matches = leaves.flatMap((leaf) => foldoutsForLeaf([item], leaf));
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, item.id);
  }
  assert.equal(foldoutsForLeaf([item], { page: 2, half: "left" }).length, 0);
  assert.equal(foldoutsForLeaf([item], { page: 3 }).length, 0);
});
test("fold-out images inherit portfolio access and cannot fetch unrelated files", async () => {
  let downloaded = "";
  const row = {
    owner_id: "owner",
    data: {
      plan: "free",
      pdf: { pages: 4, blobKey: "pdf_example", foldouts: [item] },
      profile: {},
    },
  };
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        download: async (path: string) => {
          downloaded = path;
          return {
            data: new Blob(["image"], { type: "image/jpeg" }),
            error: null,
          };
        },
      }),
    },
  };
  const open = async () => ({ policy: null, state: "open" as const });
  const url =
    "https://portfolia.site/api/public/portfolio-file/book?asset=foldout_123";
  for (const state of ["locked", "expired"] as const) {
    assert.equal(
      (
        await servePortfolioFile("book", url, db, async () => ({
          policy: null,
          state,
        }))
      ).status,
      404,
    );
    assert.equal(downloaded, "");
  }
  assert.equal(
    (
      await servePortfolioFile(
        "book",
        url.replace("foldout_123", "other_image"),
        db,
        open,
      )
    ).status,
    404,
  );
  const response = await servePortfolioFile("book", url, db, open);
  assert.equal(response.status, 200);
  assert.equal(downloaded, "owner/foldout_123");
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("text-only notes and independent surfaces retain legacy compatibility", () => {
  const text = {
    ...item,
    imageKey: undefined,
    outside: { colour: "#223344", text: "Outside" },
    inside: { colour: "#fffaf0", text: "Inside" },
  };
  assert.equal(validateFoldout(text, 4), null);
  assert.deepEqual(foldoutKeys({ pages: 4, foldouts: [text] }), []);
  assert.equal(foldoutSurfaces(item).inside.imageKey, "foldout_123");
  const pictured = {
    ...text,
    outside: { ...text.outside, imageKey: "outer_image" },
    inside: { ...text.inside, imageKey: "inner_image" },
  };
  assert.deepEqual(foldoutKeys({ pages: 4, foldouts: [pictured] }), [
    "outer_image",
    "inner_image",
  ]);
  assert.ok(
    validateFoldout(
      { ...pictured, inside: { ...pictured.inside, imageKey: "../private" } },
      4,
    ),
  );
  assert.ok(
    validateFoldout(
      { ...text, inside: { ...text.inside, text: "a".repeat(1201) } },
      4,
    ),
  );
});
test("dragging and corner resizing clamp to page and retain the opposite corner", () => {
  const moved = transformFoldout(item, -10, 10, "move");
  assert.equal(moved.x, 0);
  assert.equal(moved.y, 1 - item.height);
  const resized = transformFoldout(item, -0.1, -0.1, "nw");
  assert.ok(Math.abs(resized.x + resized.width - item.x - item.width) < 1e-9);
  assert.ok(Math.abs(resized.y + resized.height - item.y - item.height) < 1e-9);
  for (const corner of ["nw", "ne", "sw", "se"] as const)
    for (const delta of [-10, 10]) {
      const result = transformFoldout(item, delta, delta, corner);
      assert.equal(validateFoldout(result, 4), null);
      assert.ok(result.width >= 0.08 - 1e-9 && result.height >= 0.08 - 1e-9);
    }
});

test("turning page artwork contains the outside surface, never the hidden interior", async () => {
  const { paintClosedNotes } =
    await import("../src/lib/portfolia/foldout-paint");
  const images: any[] = [];
  const texts: string[] = [];
  const translations: number[][] = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect() {},
    translate(x: number, y: number) {
      translations.push([x, y]);
    },
    drawImage(image: any) {
      images.push(image);
    },
    measureText(text: string) {
      return { width: text.length * 5 };
    },
    fillText(text: string) {
      texts.push(text);
    },
  };
  const canvas = {
    width: 1000,
    height: 1400,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  const outer = { width: 200, height: 100 },
    inner = { width: 100, height: 100 };
  paintClosedNotes(
    canvas,
    [
      {
        ...item,
        outside: { colour: "#eeeeee", text: "OUTSIDE", imageKey: "outer" },
        inside: {
          colour: "#ffffff",
          text: "SECRET INTERIOR",
          imageKey: "inner",
        },
      },
    ],
    new Map([
      ["outer", outer],
      ["inner", inner],
    ]) as any,
  );
  assert.deepEqual(translations, [[550, 420]]);
  assert.deepEqual(images, [outer]);
  assert.ok(texts.join("").includes("OUTSIDE"));
  assert.ok(!texts.join("").includes("SECRET"));
});
