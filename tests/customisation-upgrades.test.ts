import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLE_PRESETS, matchingPreset, presetIsPersonal, presetPatch } from "../src/lib/portfolia/style-presets";
import { BOOK_STYLES } from "../src/lib/portfolia/book-style";
import { TURN_STYLES } from "../src/lib/portfolia/turn-motion";
import { TURN_CURVES } from "../src/lib/portfolia/turn-curve";
import { SHADE_STYLES } from "../src/lib/portfolia/shade-style";
import { HDRI_PRESETS } from "../src/lib/portfolia/lighting";
import { BACKGROUND_PRESETS } from "../src/lib/portfolia/background-presets";
import { BACKGROUND_SCENES } from "../src/lib/portfolia/background-scenes";
import { recordAppearance, stepAppearance, withCurrentFiles, clearAppearanceHistory, type AppearanceSnapshot } from "../src/lib/portfolia/appearance-history";
import { DEFAULT_VIEWER, type ViewerSettings } from "../src/lib/portfolia/store";

test("every style preset uses real options", () => {
  const backgrounds = new Set([...BACKGROUND_PRESETS.map((b) => b.id), ...BACKGROUND_SCENES.map((s) => s.id)]);
  for (const preset of STYLE_PRESETS) {
    const v = preset.viewer;
    assert.ok(BOOK_STYLES.some((b) => b.id === v.bookStyle), `${preset.id} book`);
    assert.ok(TURN_STYLES.some((t) => t.id === v.turnStyle), `${preset.id} turn`);
    assert.ok(TURN_CURVES.some((t) => t.id === v.turnCurve), `${preset.id} curve`);
    assert.ok(SHADE_STYLES.some((s) => s.id === v.simpleShading), `${preset.id} shading`);
    if (v.studioLighting) assert.ok(HDRI_PRESETS.some((h) => h.id === v.studioLighting), `${preset.id} light`);
    if (v.backgroundPreset) assert.ok(backgrounds.has(v.backgroundPreset), `${preset.id} background`);
    assert.ok(v.looks?.includes(v.look!), `${preset.id} opens in a look it offers`);
  }
  assert.equal(new Set(STYLE_PRESETS.map((p) => p.id)).size, STYLE_PRESETS.length);
  assert.ok(STYLE_PRESETS.some((p) => !presetIsPersonal(p)) && STYLE_PRESETS.some(presetIsPersonal), "free and Personal presets both exist");
});

test("applying a preset turns the flipbook on, clears picture backgrounds and is recognised afterwards", () => {
  const viewer: ViewerSettings = { ...DEFAULT_VIEWER, modes: ["scroll"], mode: "scroll", backgroundKey: "bg_mine", backgrounds: { studio: { backgroundColor: "#000" } } };
  const preset = STYLE_PRESETS[0]!;
  const next = { ...viewer, ...presetPatch(preset, viewer) };
  assert.deepEqual(next.modes, ["scroll", "book"]);
  assert.equal(next.mode, "book");
  assert.equal(next.backgroundKey, undefined);
  assert.equal(next.backgrounds, undefined);
  assert.equal(matchingPreset(next), preset.id);
  assert.equal(matchingPreset(viewer), undefined);
});

test("undo steps back through changes, a dragged slider is one step, and removed pictures never return", () => {
  clearAppearanceHistory();
  let current: AppearanceSnapshot = { code: "abc", viewer: { ...DEFAULT_VIEWER, simpleShadowOpacity: 0.2 } };
  const change = (viewer: Partial<ViewerSettings>, fields: string, at: number) => {
    recordAppearance(current, fields, at);
    current = { ...current, viewer: { ...current.viewer!, ...viewer } };
  };
  change({ simpleShadowOpacity: 0.3 }, "simpleShadowOpacity", 1000);
  change({ simpleShadowOpacity: 0.4 }, "simpleShadowOpacity", 1200);
  change({ bookStyle: "hardback" }, "bookStyle", 5000);
  const apply = (s: AppearanceSnapshot) => { const before = current; current = s; return before; };
  assert.ok(stepAppearance("undo", apply));
  assert.equal(current.viewer!.bookStyle, undefined);
  assert.equal(current.viewer!.simpleShadowOpacity, 0.4);
  assert.ok(stepAppearance("undo", apply));
  assert.equal(current.viewer!.simpleShadowOpacity, 0.2, "the whole drag undoes at once");
  assert.equal(stepAppearance("undo", apply), false);
  assert.ok(stepAppearance("redo", apply));
  assert.equal(current.viewer!.simpleShadowOpacity, 0.4);

  const kept = withCurrentFiles(
    { code: "abc", viewer: { ...DEFAULT_VIEWER, backgroundKey: "bg_old", brandLogoKey: "brand_old" }, style: { font: "x", text: "#000", background: "#fff", backdrop: "#111", bannerKey: "banner_old" } },
    { code: "abc", viewer: { ...DEFAULT_VIEWER, backgroundUploads: ["bg_new"], brandLogoKey: "brand_new" }, style: { font: "x", text: "#000", background: "#fff", backdrop: "#111", bannerKey: "banner_new" } },
    ["bg_new"],
  );
  assert.equal(kept.viewer!.backgroundKey, undefined, "a deleted upload is not brought back");
  assert.equal(kept.viewer!.brandLogoKey, "brand_new");
  assert.equal(kept.style!.bannerKey, "banner_new");
  clearAppearanceHistory();
});
