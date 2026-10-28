import test from "node:test";
import assert from "node:assert/strict";
import { captureLook, applyLook, portfolioAppearanceKeys, splitSavedLooks, readSavedLooks } from "../src/lib/portfolia/saved-looks";
import { backgroundForEveryMode } from "../src/lib/portfolia/background-settings";
import { alignExtra, extraBox, nudgeStep, snapExtraToPage } from "../src/lib/portfolia/extra-placement";
import { DEFAULT_VIEWER, type Portfolio } from "../src/lib/portfolia/store";
import { publicPortfolioPlan, publicAssetKeys } from "../src/lib/portfolia/public-assets";
import { newFoldout } from "../src/lib/portfolia/foldouts";
import { requestPreviewTurn, takePreviewTurn, subscribePreviewTurn } from "../src/lib/portfolia/preview-turn";
import { HDRI_PRESETS } from "../src/lib/portfolia/lighting";
import type { PageVideo, PageHotspot, PageTag } from "../src/lib/portfolia/page-extras";

test("looks copy visual choices and uploaded backgrounds without copying content, branding or reader policy", () => {
  const source = { ...DEFAULT_VIEWER, bookStyle: "hardback" as const, studioLighting: "8" as const, backgroundKey: "source_bg", backgrounds: { paged: { backgroundKey: "paged_bg" } }, brandLogoKey: "private_logo", hiddenPages: [2], startPage: 5, spreads: "ready" as const, autoFlip: 8 };
  const snapshot = captureLook(source);
  for (const field of ["brandLogoKey", "hiddenPages", "startPage", "spreads", "autoFlip", "mode", "modes"]) assert.equal(field in snapshot, false);
  assert.equal(snapshot.bookStyle, "hardback"); assert.equal(snapshot.backgrounds?.paged?.backgroundKey, "paged_bg");
  source.backgrounds.paged.backgroundKey = "changed";
  assert.equal(snapshot.backgrounds?.paged?.backgroundKey, "paged_bg", "snapshot owns a deep copy");
  const current = { ...DEFAULT_VIEWER, backgroundKey: "current_bg", brandLogoKey: "target_logo", hiddenPages: [1], startPage: 3 };
  const merged = { ...current, ...applyLook({ id: "look", name: "Look", viewer: snapshot }, current) };
  assert.equal(merged.brandLogoKey, "target_logo"); assert.deepEqual(merged.hiddenPages, [1]); assert.equal(merged.startPage, 3);
  assert.deepEqual(merged.backgroundUploads, ["current_bg", "source_bg", "paged_bg"]);
  assert.equal(applyLook({ id: "minimal", name: "Plain", viewer: { backgroundColor: "#fff" } }, current).backgroundKey, undefined, "absence clears the previous appearance rather than leaking it into the new look");
});
test("saved-look-only files are retained privately, not signed as active public assets", () => {
  const p = { code: "looktest", profile: { name: "A" }, viewer: DEFAULT_VIEWER, savedLooks: [{ id: "one", name: "Private look", viewer: { backgroundKey: "saved_only_bg" } }] } as Portfolio;
  assert.ok(portfolioAppearanceKeys(p).includes("saved_only_bg"));
  const split = splitSavedLooks(p);
  assert.equal("savedLooks" in split.portfolio, false, "public database row excludes the private library");
  assert.equal(split.savedLooks[0]!.name, "Private look");
  assert.deepEqual(readSavedLooks([null, {}, { id: "bad id", name: "No", viewer: {} }]), []);
  assert.equal(publicPortfolioPlan(p, true).savedLooks, undefined);
  assert.equal(publicAssetKeys(p, true).includes("saved_only_bg"), false);
});
test("copying a context background to every mode clears overrides without copying unrelated settings", () => {
  const view = { ...DEFAULT_VIEWER, backgroundKey: "main", studioLighting: "9" as const, backgrounds: { clean: { backgroundPreset: "wood_floor", backgroundFit: { scale: .5, x: .2, y: 0, tile: true } }, paged: { backgroundKey: "separate" } } };
  const patch = backgroundForEveryMode(view, "clean");
  assert.equal(patch.backgroundPreset, "wood_floor"); assert.equal(patch.backgroundKey, undefined); assert.equal(patch.backgrounds, undefined);
  assert.equal(patch.backgroundFit?.scale, .5); assert.equal("studioLighting" in patch, false);
  assert.equal(backgroundForEveryMode(view, "studio").backgroundKey, "main", "an inheriting mode copies its effective default");
});
test("alignment respects page dimensions and intrinsic video/hotspot shape", () => {
  const note = { ...newFoldout("note", 1, "right", "sticky"), width: .2, height: .3 };
  const centred = alignExtra("foldouts", alignExtra("foldouts", note, "center", 1.4), "middle", 1.4);
  assert.equal((centred as typeof note).x, .4); assert.equal((centred as typeof note).y, .35);
  const video = { id: "v", page: 1, half: "right", x: .2, y: .2, width: .4, height: .2, aspect: 2 } as PageVideo;
  const bottom = alignExtra("videos", video, "bottom", 2) as PageVideo;
  assert.ok(Math.abs(bottom.y - .9) < 1e-8); assert.ok(Math.abs(bottom.height - .1) < 1e-8);
  const hotspot = { id: "h", page: 1, half: "right", style: "video", size: .4, x: .2, y: .2 } as PageHotspot;
  const box = extraBox("hotspots", alignExtra("hotspots", hotspot, "bottom", 2), 2);
  assert.ok(Math.abs(box.y + box.height - 1) < 1e-8);
  const tag = alignExtra("tags", { id: "t", position: .5 } as PageTag, "top", 1.4) as PageTag;
  assert.equal(tag.position, .08, "edge tabs retain their safety margin");
});
test("snapping only attracts nearby edges/centres; keyboard steps provide fine and coarse placement", () => {
  const note = { ...newFoldout("note", 1, "right", "sticky"), x: .395, y: .2, width: .2, height: .2 };
  const snapped = snapExtraToPage("foldouts", note, 1.4) as typeof note;
  assert.equal(snapped.x, .4); assert.equal(snapped.y, .2);
  assert.equal(nudgeStep({ altKey: false, shiftKey: false }), .005);
  assert.equal(nudgeStep({ altKey: false, shiftKey: true }), .02);
  assert.equal(nudgeStep({ altKey: true, shiftKey: true }), .001);
});
test("test-turn requests survive a reader switch, run once, and expire instead of surprising another session", () => {
  let calls = 0; const stop = subscribePreviewTurn(() => calls++);
  requestPreviewTurn(); assert.equal(calls, 1); assert.equal(takePreviewTurn(), true); assert.equal(takePreviewTurn(), false);
  requestPreviewTurn(); assert.equal(takePreviewTurn(Date.now() + 30_001), false);
  stop(); requestPreviewTurn(); assert.equal(calls, 2); takePreviewTurn();
});
test("lighting IDs remain stable while every preset has a distinct descriptive label", () => {
  assert.deepEqual(HDRI_PRESETS.map(light => light.id), Array.from({ length: 15 }, (_, i) => String(i + 1)));
  assert.equal(new Set(HDRI_PRESETS.map(light => light.label)).size, 15);
  assert.ok(HDRI_PRESETS.every(light => !/^\d+$/.test(light.label)));
});
