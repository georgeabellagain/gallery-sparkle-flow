import test from "node:test";
import assert from "node:assert/strict";
import { paintNoteSurface } from "../src/lib/portfolia/foldout-paint";

test("note images preserve their proportions when resized, cropped, zoomed and repositioned", () => {
  const image = { width: 1200, height: 800 } as ImageBitmap;
  const images = new Map([["photo", image]]);
  for (const [width, height] of [[800, 200], [200, 800], [400, 400]]) {
    for (const imageFit of ["contain", "cover"] as const) {
      for (const imageScale of [1, 2.5]) {
        let drawn: number[] = [];
        const context = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {},
          drawImage(_image: ImageBitmap, ...coordinates: number[]) { drawn = coordinates; }
        } as unknown as CanvasRenderingContext2D;
        paintNoteSurface(context, width!, height!, {
          colour: "#ffffff", text: "", imageKey: "photo", imageFit, imageScale, imageX: .2, imageY: -.1,
        }, images);
        assert.equal(drawn.length, 4);
        assert.ok(Math.abs(drawn[2]! / drawn[3]! - image.width / image.height) < 1e-10);
        if (imageFit === "cover") {
          assert.ok(drawn[2]! >= width! && drawn[3]! >= height!);
        } else if (imageScale === 1) {
          assert.ok(drawn[2]! <= width! && drawn[3]! <= height!);
        }
      }
    }
  }
});
