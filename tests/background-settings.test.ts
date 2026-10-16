import { test } from "node:test";
import assert from "node:assert/strict";
import { backgroundFor, backgroundKeys } from "../src/lib/portfolia/background-settings";
import { DEFAULT_VIEWER } from "../src/lib/portfolia/store";
test("per-view uploaded pictures and fit stay independent from the default", () => {
  const view = {
    ...DEFAULT_VIEWER,
    backgroundKey: "shared",
    backgroundFit: { scale: 1.5, x: 0.2, y: 0 },
    backgroundUploads: ["shared", "alternate"],
    background3D: true,
    backgrounds: {
      studio: { backgroundKey: "alternate", backgroundFit: { scale: 2, x: -0.3, y: 0.4 } },
      scroll: { backgroundColor: "#abcdef" },
    },
  };
  const studio = backgroundFor(view, "studio");
  assert.equal(studio.backgroundKey, "alternate");
  assert.equal(studio.backgroundFit?.x, -0.3);
  assert.equal(studio.background3D, false);
  assert.equal(backgroundFor(view, "clean").backgroundKey, "shared");
  assert.equal(backgroundFor(view, "scroll").backgroundKey, undefined);
  assert.equal(backgroundFor(view, "scroll").backgroundColor, "#abcdef");
  assert.deepEqual(backgroundKeys(view), ["shared", "alternate"]);
  assert.equal(view.backgroundFit.x, 0.2);
});
