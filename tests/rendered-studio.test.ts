import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentRender,
  renderedAction,
  renderSignature,
  renderedKeys,
  stateForPage,
  type RenderedStudio,
} from "../src/lib/portfolia/rendered-studio";
import { DEFAULT_VIEWER, type Portfolio } from "../src/lib/portfolia/store";
import { foldoutKeys } from "../src/lib/portfolia/foldouts";
const p = {
  code: "demo",
  viewer: { ...DEFAULT_VIEWER, backgroundPreset: "wood_floor" },
  pdf: { blobKey: "pdf_demo", pages: 3, foldouts: [], tags: [], links: [] },
} as unknown as Portfolio;
const pack: RenderedStudio = {
  version: 1,
  signature: renderSignature(p),
  createdAt: 1,
  width: 1920,
  height: 1080,
  bytes: 100,
  states: [
    {
      pages: [1],
      still: "render_cover",
      forward: "render_forward",
      notes: [
        {
          id: "note",
          label: "Note",
          x: 10,
          y: 10,
          width: 20,
          height: 20,
          open: "render_open",
          close: "render_close",
          openStill: "render_openstill",
        },
      ],
      links: [],
    },
    { pages: [2, 3], still: "render_spread", backward: "render_backward", notes: [], links: [] },
  ],
};
test("all independent note and forward/backward clips participate in cloud sync and cleanup", () => {
  assert.deepEqual(foldoutKeys({ ...p.pdf!, renderedStudio: pack }), renderedKeys(pack));
  assert.equal(renderedKeys(pack).length, 7);
});
test("appearance edits invalidate a render but selecting playback does not", () => {
  const stored = { ...p, pdf: { ...p.pdf!, renderedStudio: pack } };
  assert.equal(currentRender(stored), pack);
  assert.equal(
    currentRender({ ...stored, viewer: { ...stored.viewer!, studioPlayback: "rendered" } }),
    pack,
  );
  assert.equal(
    currentRender({ ...stored, viewer: { ...stored.viewer!, studioBrightness: 1 } }),
    undefined,
  );
  assert.equal(
    currentRender({ ...stored, pdf: { ...stored.pdf, blobKey: "pdf_replaced" } }),
    undefined,
  );
});
test("signatures survive cloud JSON object key reordering", () => {
  const reversed = Object.fromEntries(Object.entries(p.viewer!).reverse());
  assert.equal(renderSignature({ ...p, viewer: reversed as typeof p.viewer }), renderSignature(p));
});
test("navigation maps PDF page numbers to recorded spreads", () => {
  assert.equal(stateForPage(pack, 3), 1);
  assert.equal(stateForPage(pack, 99), 0);
});
test("asset extraction ignores malformed states and unsafe keys", () => {
  assert.deepEqual(
    renderedKeys({
      states: [{ still: "../private", notes: null }, null],
    } as unknown as RenderedStudio),
    [],
  );
});

test("a page turn skips note opening sections unless the note was clicked", () => {
  assert.deepEqual(renderedAction(pack, 0, null, { direction: 1 })?.clips, ["render_forward"]);
  assert.deepEqual(renderedAction(pack, 0, "note", { direction: 1 })?.clips, [
    "render_close",
    "render_forward",
  ]);
  assert.deepEqual(renderedAction(pack, 0, null, { note: "note" })?.clips, ["render_open"]);
  assert.deepEqual(renderedAction(pack, 0, "note", { note: "note" })?.clips, ["render_close"]);
  assert.deepEqual(renderedAction(pack, 1, null, { direction: -1 })?.clips, ["render_backward"]);
  assert.equal(renderedAction(pack, 0, null, { direction: -1 }), null);
});

test("invalid playback metadata falls back to live Studio", () => {
  const broken = {
    ...pack,
    states: [{ ...pack.states[0]!, notes: [{ ...pack.states[0]!.notes[0]!, width: NaN }] }],
  };
  assert.equal(currentRender({ ...p, pdf: { ...p.pdf!, renderedStudio: broken } }), undefined);
});
