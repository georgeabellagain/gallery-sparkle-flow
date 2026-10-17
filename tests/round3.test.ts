import test from "node:test";
import assert from "node:assert/strict";
import { MAX_TAB_TURNS, tabTurnPlan } from "../src/lib/portfolia/tab-turns";
import { PHOTO_EXPORT_REASON, photoExportAction } from "../src/lib/portfolia/photo-export";
import { newFoldout, noteRotation, rotateFoldout, validateFoldout, MAX_NOTE_ROTATION } from "../src/lib/portfolia/foldouts";
import { shadowAlpha } from "../src/lib/portfolia/photo-grounding";
import { PERSONAL_FEATURES, PLAN_COMPARISON } from "../src/lib/portfolia/plans";
import { DISCIPLINE_PAGES } from "../src/lib/portfolia/seo-pages";
import { RESERVED } from "../src/lib/portfolia/store";

test("page tabs turn the pages one by one, quickly, and skip silently only on long jumps", () => {
  assert.deepEqual(tabTurnPlan(3, 3), { skip: null, turns: 0, dir: 1, speed: 1 });
  const near = tabTurnPlan(1, 3);
  assert.equal(near.skip, null); assert.equal(near.turns, 2); assert.ok(near.speed < 1);
  const back = tabTurnPlan(8, 5);
  assert.equal(back.dir, -1); assert.equal(back.turns, 3); assert.equal(back.skip, null);
  const far = tabTurnPlan(0, 20);
  assert.equal(far.turns, MAX_TAB_TURNS); assert.equal(far.skip, 20 - MAX_TAB_TURNS, "lands exactly on the target after its turns");
  const farBack = tabTurnPlan(20, 0);
  assert.equal(farBack.skip, MAX_TAB_TURNS);
  assert.ok(far.speed >= .3 && far.speed < near.speed, "longer journeys turn faster");
  assert.deepEqual(tabTurnPlan(0, 9, MAX_TAB_TURNS, true), { skip: 9, turns: 0, dir: 1, speed: 1 }, "reduced motion places the page");
});

test("photo shoot export is Personal; everyone can preview", () => {
  assert.equal(photoExportAction("personal"), "download");
  for (const plan of ["free", undefined] as const) assert.equal(photoExportAction(plan), "upgrade");
  assert.equal(PHOTO_EXPORT_REASON, "Photo shoot export");
  assert.ok(PERSONAL_FEATURES.some(f => f.startsWith("Photo shoot")));
  const row = PLAN_COMPARISON.flatMap(g => g.rows).find(r => r.label.startsWith("Photo shoot"));
  assert.ok(row && row.personal && row.free !== true);
});

test("notes can be slanted within limits, snapping back to straight", () => {
  const note = newFoldout("note-1", 2, "right", "sticky");
  assert.equal(validateFoldout(note, 4), null);
  assert.equal(validateFoldout(newFoldout("note-2", 2, "left", "foldout", { x: .1, y: .1 }), 4), null, "kept on the page near an edge");
  const turned = rotateFoldout(note, 12.34);
  assert.equal(turned.rotation, 12.3); assert.equal(validateFoldout(turned, 4), null);
  assert.equal(rotateFoldout(turned, 1.5).rotation, undefined, "within 2 degrees is straight");
  assert.equal(noteRotation(rotateFoldout(note, 80)), MAX_NOTE_ROTATION);
  assert.notEqual(validateFoldout({ ...note, rotation: 90 }, 4), null);
  assert.notEqual(validateFoldout({ ...note, rotation: Number.NaN }, 4), null);
  assert.equal(noteRotation({}), 0);
});

test("photo contact shadows are rounded and fade to nothing at their edges", () => {
  for (const [round, core] of [[3.2, .35], [2.2, .05], [2.4, .1]] as const) {
    assert.equal(shadowAlpha(1, 0, round, core), 0); assert.equal(shadowAlpha(0, 1, round, core), 0);
    assert.equal(shadowAlpha(.98, .98, round, core), 0, "no square corners");
    assert.ok(shadowAlpha(0, 0, round, core) > .95);
    assert.ok(shadowAlpha(.5, 0, round, core) >= shadowAlpha(.7, 0, round, core));
  }
  // The shadow behind a leaning book is darkest where it meets the floor.
  assert.ok(shadowAlpha(0, -.8, 2.4, .1, .85) > shadowAlpha(0, .8, 2.4, .1, .85));
});

test("the book mockup page is a reserved, crawlable landing page", () => {
  const page = DISCIPLINE_PAGES["book-mockup-generator"]!;
  assert.ok(page.title.length <= 70 && page.description.length <= 200);
  assert.ok(RESERVED.includes("book-mockup-generator"));
});
