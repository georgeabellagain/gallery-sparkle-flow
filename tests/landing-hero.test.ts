import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { HERO_INTRO_MAX_CHARS, PRODUCT_DEMO_PATHS, heroDemoFor, landingCopy, landingFamily } from "../src/lib/portfolia/landing-demo";
import { FREE_UPLOAD_LIMIT_MB } from "../src/lib/portfolia/store";
import { YEARLY_PER_MONTH } from "../src/lib/portfolia/plans";

const read = (path: string) => readFileSync(path, "utf8");
const LANDING_COMPONENTS = /<(SeoLanding|EmbedGuide|ProductLanding|PublicationLanding|CompetitorComparison)\b/;

/** Every public (sitemap) route whose page is one of the landing components. */
function landingRoutes() {
  const found: { file: string; path: string }[] = [];
  for (const file of readdirSync("src/routes").filter((f) => f.endsWith(".tsx"))) {
    const source = read(`src/routes/${file}`);
    const path = /createFileRoute\("([^"]+)"\)/.exec(source)?.[1];
    if (!path || path.includes("$") || !/sitemap:\s*true/.test(source) || !LANDING_COMPONENTS.test(source)) continue;
    found.push({ file, path });
  }
  return found;
}

test("every public landing route maps to one of the two live examples", () => {
  const routes = landingRoutes();
  assert.ok(routes.length >= 40, `found ${routes.length} landing routes`);
  for (const { path } of routes) {
    const demo = heroDemoFor(path);
    assert.ok(demo === "portfolio" || demo === "product", `${path} -> ${demo}`);
    const copy = landingCopy(path);
    assert.ok(copy.eyebrow.length > 0, `${path} has an eyebrow`);
    assert.equal(copy.ticks.length, 3, `${path} has three ticks`);
  }
  const paths = routes.map((r) => r.path);
  for (const path of PRODUCT_DEMO_PATHS) {
    assert.ok(paths.includes(path), `${path} is a landing route`);
    assert.equal(heroDemoFor(path), "product");
  }
  assert.equal(PRODUCT_DEMO_PATHS.length, 6);
  for (const path of paths.filter((p) => !PRODUCT_DEMO_PATHS.includes(p))) assert.equal(heroDemoFor(path), "portfolio", path);
});

test("page families get the eyebrow and ticks the plan lists", () => {
  assert.equal(landingFamily("/photography-portfolio"), "discipline");
  assert.equal(landingFamily("/pdf-to-link"), "task");
  assert.equal(landingFamily("/issuu-alternative"), "competitor");
  assert.equal(landingFamily("/flipbook-alternatives"), "competitor");
  assert.equal(landingFamily("/embed-flipbook-in-wix"), "embedding");
  assert.equal(landingFamily("/book-marketing"), "author");
  assert.equal(landingFamily("/book-mockup-generator"), "author");
  assert.equal(landingFamily("/digital-product-studio"), "product");
  assert.equal(landingCopy("/photography-portfolio").eyebrow, "Free PDF portfolio hosting");
  assert.equal(landingCopy("/embed-flipbook-in-notion").eyebrow, "Embed a PDF flipbook");
  assert.equal(landingCopy("/digital-zine-publishing").eyebrow, "Digital Product Studio");
  assert.equal(landingCopy("/book-marketing").eyebrow, "Book previews and mockups");
});

test("ticks only state what the plans enforce", () => {
  assert.equal(FREE_UPLOAD_LIMIT_MB, 30, "the task ticks say Free takes a PDF up to 30 MB");
  assert.ok(landingCopy("/pdf-to-link").ticks.some((t) => t.includes(`${FREE_UPLOAD_LIMIT_MB} MB`)));
  assert.ok(landingCopy("/issuu-alternative").ticks.some((t) => t.includes(YEARLY_PER_MONTH)), "the price comes from plans.ts");
  assert.ok(!landingCopy("/digital-product-studio").ticks.some((t) => /^free preview/i.test(t)), "publishing a product needs Personal");
});

test("every landing component opens with LandingHero and mounts no book of its own", () => {
  for (const file of ["SeoLanding", "EmbedGuide"]) assert.match(read(`src/components/pf/${file}.tsx`), /<LandingHero\b/, file);
  assert.match(read("src/components/products/ProductLanding.tsx"), /<LandingHero\b[^]*upload="product"/);
  assert.match(read("src/components/pf/SeoLanding.tsx"), /upload="portfolio"/);
  assert.match(read("src/components/pf/HomeWorkspace.tsx"), /<LandingHero\b/);
  // Competitor, publication and every SeoLanding page go through SeoLanding.
  for (const file of ["CompetitorComparison", "PublicationLanding"]) assert.match(read(`src/components/pf/${file}.tsx`), /<SeoLanding\b/, file);
  // The demos are loaded by the hero only; a second viewer anywhere on a page would mean two WebGL contexts.
  for (const file of ["pf/SeoLanding", "pf/ProfessionExample", "pf/EmbedGuide", "pf/CompetitorComparison", "pf/PublicationLanding", "pf/TaskExtras", "products/ProductLanding"]) {
    assert.doesNotMatch(read(`src/components/${file}.tsx`), /StudioDemo|ProductDemo|PdfViewer/, `${file} must not mount a viewer`);
  }
  const hero = read("src/components/pf/LandingHero.tsx");
  assert.match(hero, /lazy\(\(\) => import\("\.\/StudioDemo"\)/);
  assert.match(hero, /lazy\(\(\) => import\("\.\/ProductDemo"\)/);
  assert.match(hero, /requestIdleCallback/);
  assert.match(hero, /saveData/);
  assert.equal([...hero.matchAll(/<ExampleReader/g)].length, 1);
});

test("no landing component keeps a click-to-view gate", () => {
  const gates = ["Open example", "See a portfolio before uploading yours", "Try the PDF flipbook", "Open the 14-page fashion lookbook", "The interactive reader loads when you open it"];
  const dirs = ["src/components/pf", "src/components/products"];
  for (const dir of dirs) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const source = read(`${dir}/${file}`);
      for (const gate of gates) assert.ok(!source.includes(gate), `${dir}/${file} still has "${gate}"`);
    }
  }
  for (const { file } of landingRoutes()) for (const gate of gates) assert.ok(!read(`src/routes/${file}`).includes(gate), `${file} has "${gate}"`);
});

test("the profession examples load into the hero's viewer instead of their own", () => {
  const example = read("src/components/pf/ProfessionExample.tsx");
  assert.match(example, /showExample\(/);
  assert.match(example, /useHeroExample/);
  assert.match(read("src/components/pf/SeoLanding.tsx"), /<LandingExampleProvider>/);
  assert.match(read("src/components/pf/LandingHero.tsx"), /id="landing-hero"/);
});

test("the hero's introduction is printed in full below it when it is cut", () => {
  assert.ok(HERO_INTRO_MAX_CHARS > 0);
  assert.match(read("src/components/pf/SeoLanding.tsx"), /c\.intro\.length > HERO_INTRO_MAX_CHARS/);
  assert.match(read("src/components/products/ProductLanding.tsx"), /c\.intro\.length > HERO_INTRO_MAX_CHARS/);
  assert.match(read("src/components/pf/EmbedGuide.tsx"), /<p className="text-muted-foreground">\{intro\}<\/p>/);
});

test("the home page keeps its tab in the address and its labels", () => {
  const home = read("src/components/pf/HomeWorkspace.tsx");
  assert.match(home, /searchParams\.set\("for", "products"\)/);
  assert.ok(home.includes("Share a portfolio") && home.includes("Sell a digital product"));
  assert.ok(home.includes("Free PDF portfolio hosting") && home.includes("Digital Product Studio"));
});
