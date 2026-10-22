import { test } from "node:test";
import assert from "node:assert/strict";
import { frameSeconds, gifFileProblem, isGif, videoSizeFor } from "../src/lib/portfolia/gif-to-video";
import { validatePageVideo, type PageVideo } from "../src/lib/portfolia/page-extras";

test("GIFs are recognised by type or name", () => {
  assert.ok(isGif(new File([], "loop.gif")));
  assert.ok(isGif(new File([], "loop", { type: "image/gif" })));
  assert.equal(isGif(new File([], "clip.mp4", { type: "video/mp4" })), false);
});

test("the video keeps the GIF's shape at even sizes within 1280 pixels", () => {
  assert.deepEqual(videoSizeFor(480, 270), { width: 480, height: 270 });
  assert.deepEqual(videoSizeFor(301, 199), { width: 302, height: 200 });
  assert.deepEqual(videoSizeFor(2560, 1440), { width: 1280, height: 720 });
  assert.deepEqual(videoSizeFor(1, 1), { width: 2, height: 2 });
});

test("frames play at the pace browsers give GIFs", () => {
  assert.equal(frameSeconds(0), 0.1);
  assert.equal(frameSeconds(10_000), 0.1);
  assert.equal(frameSeconds(null), 0.1);
  assert.equal(frameSeconds(40_000), 0.04);
  assert.equal(frameSeconds(500_000), 0.5);
});

test("oversized GIFs are refused before converting", () => {
  assert.ok(gifFileProblem({ size: 41 * 1048576 } as File));
  assert.equal(gifFileProblem({ size: 2 * 1048576 } as File), null);
});

test("a GIF-made video is marked silent; any other value is refused", () => {
  const v: PageVideo = { id: "vid_1", page: 1, half: "left", x: 0.1, y: 0.1, width: 0.5, height: 0.3, aspect: 1.6, blobKey: "video_1", posterKey: "video_1_poster.jpg", mime: "video/mp4", bytes: 1000 };
  assert.equal(validatePageVideo({ ...v, silent: true }, 3), null);
  assert.ok(validatePageVideo({ ...v, silent: false as unknown as true }, 3));
});
