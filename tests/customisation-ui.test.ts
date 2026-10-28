import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHooks } from "node:module";
registerHooks({
  load(url, context, next) {
    if (/\.(png|jpg|webp|svg|css)$/.test(url))
      return {
        format: "module",
        source: `export default ${JSON.stringify(url)}`,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
const { StyleForm } = await import("../src/components/pf/StyleForm");
import { HDRI_PRESETS } from "../src/lib/portfolia/lighting";
import { DEFAULT_VIEWER, type Portfolio } from "../src/lib/portfolia/store";
const p = {
  code: "test",
  plan: "free",
  profile: { name: "Test" },
  viewer: { ...DEFAULT_VIEWER, look: "studio", looks: ["clean", "studio"] },
} as Portfolio;
test("visual style presents three mode tiles and a separate first-view selection", () => {
  const html = renderToStaticMarkup(
    createElement(StyleForm, { p, part: "reading", onSaveError: () => {} }),
  );
  assert.ok(html.includes("Visitors can read as"));
  assert.ok(html.includes("Opens in"));
  for (const label of ["Scroll", "Page by page", "Flipbook"])
    assert.equal(html.split(`>${label}</span>`).length - 1, 1);
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes("One page per PDF page"));
  assert.ok(html.includes("A spread per PDF page"));
});
test("lighting and paper have separate panels and all fifteen HDRIs are selectable", () => {
  const lighting = renderToStaticMarkup(
    createElement(StyleForm, { p, part: "look", onSaveError: () => {} }),
  );
  for (const light of HDRI_PRESETS) assert.ok(lighting.includes(`aria-label="Lighting ${light.id}: ${light.label}"`));
  assert.equal((lighting.match(/type="number"/g) ?? []).length, 3, "each lighting slider has precise number entry");
  assert.ok(lighting.includes('max="200"'));
  assert.ok(lighting.includes("Reset lighting"));
  // Opens on the look the book opens in; the other is one tab away.
  assert.ok(lighting.includes("Adjust Simple"));
  assert.ok(lighting.includes("Open in Studio"));
  assert.ok(!lighting.includes("Newspaper"));
  const paper = renderToStaticMarkup(
    createElement(StyleForm, { p, part: "paper", onSaveError: () => {} }),
  );
  for (const label of ["Matte", "Satin", "Crumbled", "Newspaper"]) assert.ok(paper.includes(label));
  assert.ok(!paper.includes("Studio HDRI"));
  assert.ok(paper.includes("Test page turn"));
  assert.ok(paper.includes("Preview paper in Studio"));
});
test("background panel displays per-view previews, a colour wheel and texture presets", () => {
  const html = renderToStaticMarkup(
    createElement(StyleForm, { p, part: "background", onSaveError: () => {} }),
  );
  for (const label of [
    "Flipbook · Studio",
    "Flipbook · Simple",
    "Scroll",
    "Page by page",
    "Colour wheel",
    "Surfaces",
    "Colour &amp; motion",
  ])
    assert.ok(html.includes(label));
  assert.ok(!html.includes("3D background"));
  assert.ok(!html.includes("<select"));
});

test("live scrapbook provides move and resize controls over the actual page coordinates", async () => {
  const { LiveScrapbookPage } = await import("../src/components/pf/LiveScrapbookPage");
  const { LiveScrapbookContext } = await import("../src/components/pf/live-scrapbook-context");
  const portfolio = {
    ...p,
    pdf: {
      blobKey: "pdf",
      pages: 2,
      foldouts: [
        {
          id: "note",
          page: 1,
          half: "right",
          title: "Live note",
          colour: "#ffffff",
          hinge: "top",
          x: 0.2,
          y: 0.3,
          width: 0.3,
          height: 0.2,
        },
      ],
      links: [
        {
          id: "link",
          page: 1,
          half: "right",
          url: "https://example.com/",
          x: 0.2,
          y: 0.5,
          size: 0.1,
        },
      ],
      tags: [{ id: "tab", page: 1, label: "Next", colour: "#ffffff", position: 0.5 }],
    },
  } as Portfolio;
  const html = renderToStaticMarkup(
    createElement(
      LiveScrapbookContext.Provider,
      { value: { portfolio, enabled: true, onError: () => {} } },
      createElement(LiveScrapbookPage, { leaf: { page: 1 }, side: "right", ratio: 1.4 }),
    ),
  );
  assert.ok(html.includes("Move fold-out Live note"));
  assert.ok(html.includes("left:20%;top:30%;width:30%;height:20%"));
  assert.ok(html.includes("Resize note nw"));
  assert.ok(html.includes("Resize note se"));
  assert.ok(html.includes("Move website link"));
  assert.ok(html.includes("Resize link se"));
  assert.ok(html.includes("Move page tab Next"));
  assert.ok(html.includes("Resize tab se"));
});
