import { test } from "node:test";
import assert from "node:assert/strict";
import { bookSurfaceRatio, bookMotionBudget } from "../src/lib/portfolia/render-budget";

test("fullscreen surfaces respect the GPU budget even above 4K", () => {
  for (const [w, h] of [[390, 844], [1920, 1080], [3840, 2160], [7680, 4320]]) {
    const ratio = bookSurfaceRatio(w, h, 1.25, 2_600_000);
    assert.ok(w * h * ratio * ratio <= 2_600_001);
  }
});

test("fullscreen turns retain reading resolution within budget", () => {
  for (const [w, h] of [[1920, 1080], [3840, 2160]]) {
    const rest = bookSurfaceRatio(w, h, 1.25, bookMotionBudget(2_600_000, false));
    const moving = bookSurfaceRatio(w, h, 1.25, bookMotionBudget(2_600_000, true));
    assert.ok(w * h * moving ** 2 <= 2_600_001);
    assert.equal(moving, rest);
    assert.equal(bookMotionBudget(2_600_000, false), 2_600_000);
  }
  assert.equal(bookSurfaceRatio(640, 480, 1.25, bookMotionBudget(2_600_000, true)), 1.25);
});

test("slow-device adjustment still reduces work when fullscreen is already below 1x", () => {
  const normal = bookSurfaceRatio(3840, 2160, 1, 2_600_000);
  const reduced = bookSurfaceRatio(3840, 2160, 0.8, 2_600_000);
  assert.ok(reduced < normal);
  assert.equal(bookSurfaceRatio(390, 844, 1.25, 2_600_000), 1.25);
});


test("each adaptive step reduces capped fullscreen fragment work while preserving reading detail", () => {
  for (const [w, h] of [[1920,1080], [3840,2160], [7680,4320]]) {
    let previous = w * h * bookSurfaceRatio(w,h,2,bookMotionBudget(5_200_000,true)) ** 2;
    for (let step=1; step<=3; step++) {
      const scale=.9 ** step;
      const budget=bookMotionBudget(5_200_000,true,scale);
      const pixels=w*h*bookSurfaceRatio(w,h,2*scale,budget) ** 2;
      assert.ok(pixels <= previous*.810001);
      assert.equal(bookMotionBudget(5_200_000,false,scale),5_200_000);
      previous=pixels;
    }
  }
});
