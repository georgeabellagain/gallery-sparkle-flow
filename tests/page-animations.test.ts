import test from "node:test";
import assert from "node:assert/strict";
import { animationFileProblem, animationFrameIndex, animationFrameSeconds, animationFrameSize, animationKind } from "../src/lib/portfolia/page-animation";
import { ANIMATION_MAX_MB, MAX_ANIMATIONS, animationKeys, placeSticker, readablePageStickers, stickerLabel, stickersForPage, validatePageSticker, type PageSticker } from "../src/lib/portfolia/page-extras";
import { foldoutKeys } from "../src/lib/portfolia/foldouts";
import { LIBRARY_SIZE, libraryEmoji, libraryUrl, searchLibrary } from "../src/lib/portfolia/animation-library";

const animation = (over: Partial<PageSticker> = {}): PageSticker => ({ id: "sticker_a1", page: 2, half: "right", sticker: "animation", colour: "#1c1c1c", x: 0.2, y: 0.2, size: 0.3, image: { key: "anim_abc", name: "Waving fox" }, ...over });

test("a looping animation goes round; the others stop on the last frame or come back to rest", () => {
  const frames = [0.1, 0.2, 0.1];
  assert.deepEqual([0, 0.05, 0.11, 0.29, 0.31, 0.39].map((t) => animationFrameIndex(frames, t, true)), [0, 0, 1, 1, 2, 2]);
  assert.equal(animationFrameIndex(frames, 0.45, true), 0);
  assert.equal(animationFrameIndex(frames, 4.15, true), 1);
  assert.equal(animationFrameIndex(frames, 9, false), 2);
  assert.equal(animationFrameIndex(frames, 9, false, "first"), 0);
  assert.equal(animationFrameIndex(frames, 0.15, false, "first"), 1);
  for (const odd of [-1, NaN, Infinity]) assert.equal(animationFrameIndex(frames, odd, true), 0);
  assert.equal(animationFrameIndex([0.1], 5, true), 0);
  assert.equal(animationFrameIndex([], 5, true), 0);
});

test("frames keep the picture's shape within the size and memory allowed", () => {
  assert.deepEqual(animationFrameSize(512, 512, 30), { width: 512, height: 512 });
  assert.deepEqual(animationFrameSize(2000, 1000, 10), { width: 512, height: 256 });
  const long = animationFrameSize(512, 512, 240);
  assert.ok(long.width < 512 && long.width >= 96 && long.width * long.height * 4 * 240 <= 41 * 1048576);
  assert.deepEqual(animationFrameSize(40, 20, 4), { width: 40, height: 20 });
  assert.equal(animationFrameSeconds(0), 0.1);
  assert.equal(animationFrameSeconds(10_000), 0.1);
  assert.equal(animationFrameSeconds(40_000), 0.04);
});

test("a file is judged by what it is, not by its name", () => {
  const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
  assert.equal(animationKind(bytes("GIF89a......")), "image/gif");
  assert.equal(animationKind(bytes("RIFFxxxxWEBPVP8X")), "image/webp");
  assert.equal(animationKind(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), "image/png");
  assert.equal(animationKind(bytes("<svg onload=alert(1)>")), null);
  assert.equal(animationKind(bytes("<!doctype html>")), null);
  assert.match(animationFileProblem({ size: 10, name: "x.svg" }, null) ?? "", /GIF, WebP or PNG/);
  assert.match(animationFileProblem({ size: (ANIMATION_MAX_MB + 1) * 1048576, name: "x.gif" }, "image/gif") ?? "", /up to 2 MB/);
  assert.equal(animationFileProblem({ size: 500_000, name: "x.gif" }, "image/gif"), null);
});

test("an animation needs its picture and a known way of playing; drawn stickers can't carry either", () => {
  assert.equal(validatePageSticker(animation(), 10), null);
  for (const play of ["loop", "open", "tap"] as const) assert.equal(validatePageSticker(animation({ play }), 10), null);
  assert.equal(validatePageSticker(animation({ flip: true, size: 1, x: 0, y: 0 }), 10), null);
  assert.ok(validatePageSticker(animation({ image: undefined }), 10));
  assert.ok(validatePageSticker(animation({ image: { key: "../../etc/passwd" } }), 10));
  assert.ok(validatePageSticker(animation({ image: { key: "https://evil.example/x.gif" } }), 10));
  assert.ok(validatePageSticker(animation({ play: "always" as never }), 10));
  assert.ok(validatePageSticker(animation({ image: { key: "anim_abc", credit: "other" as never } }), 10));
  assert.ok(validatePageSticker(animation({ size: 1.2 }), 10));
  const star: PageSticker = { id: "sticker_s1", page: 1, half: "left", sticker: "star", colour: "#e8604c", x: 0.1, y: 0.1, size: 0.12 };
  assert.equal(validatePageSticker(star, 10), null);
  assert.ok(validatePageSticker({ ...star, size: 0.8 }, 10), "a drawn sticker stays small");
  assert.ok(validatePageSticker({ ...star, play: "tap" }, 10));
  assert.ok(validatePageSticker({ ...star, image: { key: "anim_abc" } }, 10));
  assert.equal(stickerLabel(animation()), "Waving fox");
  assert.equal(stickerLabel(animation({ image: { key: "anim_abc" } })), "Animation");
  assert.equal(stickerLabel(star), "Star");
});

test("animations can fill the page width, stay on the page and keep their settings on every reading style", () => {
  const big = placeSticker(animation(), 0.5, 0.9, 3, 1.4);
  assert.equal(big.size, 1);
  assert.equal(big.x, 0);
  assert.ok(big.y + big.size / 1.4 <= 1 + 1e-9);
  const [onSheet] = stickersForPage([animation({ play: "tap", flip: true })], 2, true);
  assert.equal(onSheet?.play, "tap");
  assert.equal(onSheet?.flip, true);
  assert.equal(onSheet?.image?.key, "anim_abc");
});

test("a portfolio keeps at most the allowed animations, and their pictures sync and publish with it", () => {
  const many = Array.from({ length: MAX_ANIMATIONS + 6 }, (_, i) => animation({ id: `sticker_${i}`, image: { key: `anim_${i}` } }));
  const kept = readablePageStickers(many, 10);
  assert.equal(kept.length, MAX_ANIMATIONS);
  assert.deepEqual(animationKeys([animation(), animation({ id: "sticker_b", image: { key: "anim_def" } })], 10), ["anim_abc", "anim_def"]);
  assert.deepEqual(animationKeys([{ ...animation(), image: { key: "bad key!" } }], 10), []);
  const keys = foldoutKeys({ pages: 10, stickers: [animation(), animation({ id: "sticker_copy" })] });
  assert.deepEqual(keys, ["anim_abc"], "a duplicate shares the one stored picture");
});

test("the library is searched on the device and only ever points at its own catalogue", () => {
  assert.ok(LIBRARY_SIZE > 800);
  const cats = searchLibrary("cat");
  assert.ok(cats.length >= 5 && cats.every((a) => /\bcat/.test(a.words)));
  assert.ok(searchLibrary("rock").some((a) => a.name === "rocket"), "a word may be the start of a name");
  assert.equal(searchLibrary("rocket")[0]?.name, "rocket");
  assert.deepEqual(searchLibrary("zzzzqq"), []);
  assert.ok(searchLibrary("", 2, 500).every((a) => a.category === 2));
  assert.equal(searchLibrary("", null, 12).length, 12);
  const rocket = searchLibrary("rocket")[0]!;
  assert.equal(libraryUrl(rocket.code), `https://fonts.gstatic.com/s/e/notoemoji/latest/${rocket.code}/512.webp`);
  assert.equal(libraryEmoji("1f680"), "\u{1F680}");
  for (const bad of ["../../x", "1f680/../../evil", "https://evil.example", "", "zzzz"]) assert.equal(libraryUrl(bad), null);
});
