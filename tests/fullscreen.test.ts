import { test } from "node:test";
import assert from "node:assert/strict";
import { toggleFullscreen, type FullscreenDocument, type FullscreenElement } from "../src/lib/portfolia/fullscreen";

test("fullscreen uses the supplied editor surface, retaining sibling tools", async () => {
  let requested: unknown;
  const stage = { requestFullscreen() { requested = this; return Promise.resolve(); } } as FullscreenElement;
  assert.equal(await toggleFullscreen(stage, { fullscreenEnabled: true } as FullscreenDocument, false), "native");
  assert.equal(requested, stage);
});
test("refused or unsupported fullscreen falls back and can be closed", async () => {
  const stage = { requestFullscreen() { return Promise.reject(new Error("Unsupported")); } } as FullscreenElement;
  const doc = {} as FullscreenDocument;
  assert.equal(await toggleFullscreen(stage, doc, false), "fallback");
  assert.equal(await toggleFullscreen(stage, doc, true), "exited");
  assert.equal(await toggleFullscreen(null, doc, false), "fallback");
});
test("native exit and Safari-prefixed fullscreen preserve their receiver", async () => {
  let exited = false, requested: unknown;
  const stage = { webkitRequestFullscreen() { requested = this; } } as FullscreenElement;
  assert.equal(await toggleFullscreen(stage, { webkitFullscreenEnabled: true } as FullscreenDocument, false), "native");
  assert.equal(requested, stage);
  const doc = { webkitFullscreenElement: stage, webkitExitFullscreen() { exited = this === doc; } } as unknown as FullscreenDocument;
  assert.equal(await toggleFullscreen(stage, doc, false), "exited");
  assert.equal(exited, true);
});
