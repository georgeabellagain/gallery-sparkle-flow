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
  assert.ok(html.includes("Visual styles visitors can use"));
  assert.ok(html.includes("Shows first"));
  for (const label of ["Scroll", "Page by page", "Flipbook"])
    assert.equal(html.split(`>${label}</span>`).length - 1, 2);
  assert.ok(html.includes('aria-pressed="true"'));
});
test("lighting and paper have separate panels and all fifteen HDRIs are selectable", () => {
  const lighting = renderToStaticMarkup(
    createElement(StyleForm, { p, part: "look", onSaveError: () => {} }),
  );
  assert.equal((lighting.match(/aria-label="Lighting \d+"/g) ?? []).length, 15);
  assert.ok(lighting.includes("Simple shadow"));
  assert.ok(lighting.includes("Shows first"));
  assert.ok(!lighting.includes("Newspaper"));
  const paper = renderToStaticMarkup(
    createElement(StyleForm, { p, part: "paper", onSaveError: () => {} }),
  );
  for (const label of ["Matte", "Satin", "Crumbled", "Newspaper"]) assert.ok(paper.includes(label));
  assert.ok(!paper.includes("Studio HDRI"));
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
    "Presets",
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
