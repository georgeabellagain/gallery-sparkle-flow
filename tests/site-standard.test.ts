import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { guideIndex } from "../src/lib/portfolia/guide-index";
import { landingFamily, relatedGuides } from "../src/lib/portfolia/landing-demo";
import { SEO_LINKS } from "../src/lib/portfolia/seo-pages";
import { COMPETITORS, comparisonContent } from "../src/lib/portfolia/competitors";
import { PROOF_FIGURES, PROOF_QUOTES } from "../src/lib/portfolia/proof";
import { RESERVED } from "../src/lib/portfolia/store";

const read = (path: string) => readFileSync(path, "utf8");
const LANDING = /<(SeoLanding|EmbedGuide|ProductLanding|PublicationLanding|CompetitorComparison)\b/;
const landingPaths = () => readdirSync("src/routes").filter((f) => f.endsWith(".tsx")).map((f) => read(`src/routes/${f}`)).filter((s) => LANDING.test(s) && /sitemap:\s*true/.test(s)).map((s) => /createFileRoute\("([^"]+)"\)/.exec(s)![1]!);

test("every public page shares the marketing header with routes to Examples, Products and Pricing", () => {
  const chrome = read("src/components/pf/Chrome.tsx");
  for (const [href, label] of [["/examples", "Examples"], ["/digital-product-studio", "Products"], ["/book-marketing", "For authors"], ["/pricing", "Pricing"]]) {
    assert.ok(chrome.includes(`href: "${href}", label: "${label}"`), label);
  }
  assert.match(chrome, /Upload a PDF/);
  assert.match(chrome, /aria-label="Open the menu"/, "phones get a menu button");
  for (const file of ["components/pf/SeoLanding", "components/pf/EmbedGuide", "components/products/ProductLanding", "components/pf/HomeWorkspace", "components/pf/LegalPage", "routes/pricing", "routes/examples", "routes/guides", "routes/portfolio-checker", "routes/__root"]) {
    assert.match(read(`src/${file}.tsx`), /<MarketingHeader\b/, file);
  }
  for (const file of ["routes/dashboard", "routes/products"]) assert.match(read(`src/${file}.tsx`), /<AppHeader\b/, file);
  assert.match(read("src/components/pf/Chrome.tsx"), /Sign out/);
});

test("every guide page is within two clicks: footer, then /guides", () => {
  const footer = read("src/components/pf/Chrome.tsx");
  for (const href of ["/guides", "/examples", "/pricing", "/flipbook-alternatives", "/portfolio-checker"]) assert.ok(footer.includes(`"${href}"`), href);
  const listed = new Set(guideIndex().flatMap((g) => g.links.map((l) => l.to)));
  for (const path of landingPaths()) assert.ok(listed.has(path), `${path} is on /guides`);
  for (const slug of ["examples", "guides"]) assert.ok(RESERVED.includes(slug), `${slug} cannot be claimed as a personal address`);
});

test("related guides are at most eight, same family first", () => {
  const related = relatedGuides("/photography-portfolio", SEO_LINKS);
  assert.ok(related.length <= 8);
  assert.ok(!related.some((l) => l.to === "/photography-portfolio"));
  assert.equal(landingFamily(related[0]!.to), "discipline");
});

test("the home page follows the plan's order and keeps its anchors", () => {
  const home = read("src/components/pf/HomeMarketing.tsx");
  const order = ["<ProofStrip", "<HowItWorks", "<FeatureRows", "<FeatureGrid", "<ExamplesTeaser", "<ProductBand", 'id="pricing"', "<CareRow", 'id="faq-title"'].map((s) => home.indexOf(s));
  assert.ok(order.every((i) => i >= 0), "every section is there");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in order");
  assert.ok(!home.includes("PdfVersusLink") && !home.includes("SwitchCompare") && !home.includes("PlanTable"), "removed sections are gone from home");
  assert.match(read("src/routes/pdf-to-link.tsx"), /<PdfVersusLink/);
  assert.match(read("src/components/pf/CompetitorComparison.tsx"), /<SwitchCompare/);
  assert.match(read("src/components/pf/HomeWorkspace.tsx"), /id="about"/);
});

test("marketing components never show an image without alt, width and height", () => {
  for (const file of ["components/pf/HomeSections", "components/pf/SeoSections", "components/pf/Media", "components/pf/ProofStrip", "routes/examples", "routes/guides"]) {
    for (const tag of read(`src/${file}.tsx`).match(/<img\b[^>]*>/g) ?? []) assert.ok(/\balt=/.test(tag) && /\bwidth=/.test(tag) && /\bheight=/.test(tag), `${file}: ${tag.slice(0, 80)}`);
  }
});

test("no invented proof", () => {
  for (const f of PROOF_FIGURES) assert.ok(f.asOf && f.value && f.label, "figures carry a date");
  for (const q of PROOF_QUOTES) assert.ok(q.permission.length > 0, "quotes carry their permission");
});

test("competitor headings use the right article", () => {
  const issuu = COMPETITORS.find((c) => c.slug === "issuu-alternative")!;
  assert.equal(comparisonContent(issuu).h1, "An Issuu alternative");
  const flipsnack = COMPETITORS.find((c) => c.slug === "flipsnack-alternative")!;
  assert.equal(comparisonContent(flipsnack).h1, "A Flipsnack alternative");
});

test("the buyer page keeps one Buy button and the access flow", () => {
  const page = read("src/routes/product.$id.tsx");
  assert.match(page, /window\.location\.hash\.slice\(1\)\)\.get\("access"\)/, "the token is still read from the fragment");
  assert.match(page, /redeemProduct\(/);
  assert.match(page, /Made with Portfolia/);
  assert.ok(!page.includes("<MarketingHeader"), "no Portfolia menu for buyers");
});
