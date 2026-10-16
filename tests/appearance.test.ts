import test from "node:test";
import assert from "node:assert/strict";
import { looksForMode, openingLook } from "../src/lib/portfolia/appearance";
import { DEFAULT_VIEWER } from "../src/lib/portfolia/store";

test("the creator can choose Studio to open first when both looks are offered", () => {
  const view = { ...DEFAULT_VIEWER, look: "studio" as const, looks: ["clean", "studio"] as ("clean" | "studio")[] };
  for (const mode of ["book", "scroll", "paged"] as const) assert.equal(openingLook(view, mode), "studio");
});
test("Studio-only and legacy appearance choices remain supported", () => {
  assert.equal(openingLook({ ...DEFAULT_VIEWER, looks: ["studio"] }, "book"), "studio");
  assert.equal(openingLook({ ...DEFAULT_VIEWER, look: "studio" }, "scroll"), "studio");
});
test("Studio availability belongs to each mode and never leaves a reader without an appearance", () => {
  const view = { ...DEFAULT_VIEWER, looks: ["clean", "studio"] as ("clean" | "studio")[], studioModes: ["book", "paged"] as ("book" | "paged")[] };
  assert.deepEqual(looksForMode(view, "scroll"), ["clean"]);
  assert.deepEqual(looksForMode(view, "paged"), ["clean", "studio"]);
  assert.deepEqual(looksForMode({ ...view, looks: ["studio"] }, "scroll"), ["clean"]);
  assert.deepEqual(looksForMode({ ...view, studioModes: [] }, "book"), ["clean"]);
});

test("editor mode previews reset without changing the creator's opening mode",async()=>{
 const {setPreviewMode,getPreviewMode,subscribePreviewMode}=await import('../src/lib/portfolia/preview-look');
 const seen:Array<string|null>=[];const stop=subscribePreviewMode(v=>seen.push(v));
 setPreviewMode('scroll');assert.equal(getPreviewMode(),'scroll');setPreviewMode('paged');setPreviewMode(null);stop();
 assert.deepEqual(seen,['scroll','paged',null]);
});
