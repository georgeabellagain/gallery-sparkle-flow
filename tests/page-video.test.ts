import test from "node:test";
import assert from "node:assert/strict";
import { placeVideo, readablePageVideos, validatePageVideo, videoHeight, videosForLeaf, videosForPage, VIDEO_MAX_MB, type PageVideo } from "../src/lib/portfolia/page-extras";
import { choosePlaying, MAX_PLAYING } from "../src/lib/portfolia/page-video-player";
import { PAGE_VIDEO_FRAGMENT, videoUvRect } from "../src/lib/portfolia/page-video";
import { publicAssetKeys, publicPortfolioPlan } from "../src/lib/portfolia/public-assets";
import { premiumAppearance } from "../src/lib/portfolia/premium-appearance";
import { foldoutKeys } from "../src/lib/portfolia/foldouts";
import { transformExtra } from "../src/lib/portfolia/scrapbook-transform";
import type { Portfolio } from "../src/lib/portfolia/store";

const video = (over: Partial<PageVideo> = {}): PageVideo => ({
  id: "vid_1", page: 2, half: "right", x: 0.2, y: 0.3, width: 0.6, height: 0.6 / ((16 / 9) * 1.4), aspect: 16 / 9,
  blobKey: "video_abc", posterKey: "video_abc_poster.jpg", mime: "video/mp4", bytes: 5_000_000, name: "reel.mp4", ...over,
});

test("a valid page video passes; bad files, sizes and positions are refused", () => {
  assert.equal(validatePageVideo(video(), 4), null);
  assert.match(validatePageVideo(video({ page: 9 }), 4)!, /page/);
  assert.match(validatePageVideo(video({ mime: "video/quicktime" as never }), 4)!, /MP4 or WebM/);
  assert.match(validatePageVideo(video({ bytes: VIDEO_MAX_MB * 1048576 + 1 }), 4)!, new RegExp(`${VIDEO_MAX_MB} MB`));
  assert.match(validatePageVideo(video({ x: 0.6 }), 4)!, /on the page/);
  assert.match(validatePageVideo(video({ blobKey: "../escape" }), 4)!, /file/);
});

test("only one moving video per page side, and at most six in all", () => {
  const list = [video(), video({ id: "vid_2" }), video({ id: "vid_3", half: "left" }), ...Array.from({ length: 8 }, (_, i) => video({ id: `v${i}`, page: 3 + (i % 2), half: i < 4 ? "left" : "right" }))];
  const readable = readablePageVideos(list, 10);
  assert.ok(readable.length <= 6);
  const sides = readable.map((v) => `${v.page}:${v.half}`);
  assert.equal(new Set(sides).size, sides.length);
});

test("moving and resizing keeps the video's shape and keeps it on the page", () => {
  const ratio = 1.4, v = video();
  const bigger = transformExtra("videos", v, 0.3, 0, "se", ratio) as PageVideo;
  assert.ok(bigger.width > v.width);
  assert.ok(Math.abs(bigger.height - videoHeight(bigger, ratio)) < 1e-9);
  assert.ok(bigger.x + bigger.width <= 1 + 1e-9 && bigger.y + bigger.height <= 1 + 1e-9);
  const moved = placeVideo(v, 5, 5, v.width, ratio);
  assert.ok(moved.x + moved.width <= 1 + 1e-9 && moved.y + moved.height <= 1 + 1e-9);
  assert.equal(validatePageVideo(moved, 4), null);
});

test("leaf and full-page placement", () => {
  assert.equal(videosForLeaf([video()], { page: 2, half: "left" }).length, 0);
  assert.equal(videosForLeaf([video()], { page: 2 }).length, 1);
  const [onPage] = videosForPage([video()], 2, true);
  assert.ok(Math.abs(onPage!.x - (0.5 + 0.1)) < 1e-9 && Math.abs(onPage!.width - 0.3) < 1e-9);
});

test("at most two videos play at once, in reading order", () => {
  assert.equal(MAX_PLAYING, 2);
  assert.deepEqual(choosePlaying(["a", "b", "c", "a"]), ["a", "b"]);
});

test("the box maps to texture coordinates (bottom-left origin) and the shader patch replaces the print in both lighting paths", () => {
  assert.deepEqual(videoUvRect({ x: 0.1, y: 0.2, width: 0.5, height: 0.25 }), [0.1, 0.55, 0.6, 0.8]);
  assert.match(PAGE_VIDEO_FRAGMENT.afterMap, /diffuseColor\.rgb = diffuse \* pageVideoColour/);
  assert.match(PAGE_VIDEO_FRAGMENT.afterEmissive, /totalEmissiveRadiance = emissive \* pageVideoColour/);
});

test("videos are a Personal feature: saving asks to upgrade, unpaid public links drop them", () => {
  const p = { code: "abcde", status: "published", profile: { name: "A", title: "", intro: "", email: "", links: [] }, pdf: { blobKey: "pdf_1", name: "a.pdf", bytes: 1, pages: 4, uploadedAt: 0, videos: [video()] }, allowDownload: true, plan: "free", createdAt: 0 } as unknown as Portfolio;
  assert.ok(premiumAppearance(p).includes("Videos on pages"));
  assert.ok(foldoutKeys(p.pdf).includes("video_abc") && foldoutKeys(p.pdf).includes("video_abc_poster.jpg"));
  assert.ok(!publicAssetKeys(p, false).some((k) => k.startsWith("video_abc")));
  assert.ok(publicAssetKeys(p, true).includes("video_abc"));
  assert.equal(publicPortfolioPlan(p, false).pdf?.videos, undefined);
  assert.equal(publicPortfolioPlan(p, true).pdf?.videos?.length, 1);
});
