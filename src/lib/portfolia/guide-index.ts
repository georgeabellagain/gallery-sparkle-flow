import { SEO_LINKS } from "./seo-pages";
import { COMPETITORS } from "./competitors";
import { landingFamily, type LandingFamily } from "./landing-demo";

/**
 * Every guide page, grouped by family, for /guides. The footer links /guides, so every SEO page is within two clicks of
 * any page (plan 2, S9); tests/site-standard.test.ts checks no landing route is missing.
 */
const EXTRA = [
  ...COMPETITORS.map(c => ({ to: `/${c.slug}`, label: `${c.name} alternative` })),
  { to: "/embed-flipbook-in-squarespace", label: "Embed in Squarespace" },
  { to: "/embed-flipbook-in-wix", label: "Embed in Wix" },
  { to: "/embed-flipbook-in-notion", label: "Embed in Notion" },
  { to: "/digital-product-studio", label: "Digital Product Studio" },
  { to: "/etsy-digital-product-preview", label: "Etsy digital product previews" },
  { to: "/digital-zine-publishing", label: "Digital zine publishing" },
];

const FAMILY_TITLES: Record<LandingFamily, string> = {
  discipline: "Portfolios by discipline",
  task: "Things to do with a PDF",
  publication: "Zines, magazines and lookbooks",
  author: "For authors",
  product: "Selling digital products",
  embedding: "Embedding guides",
  competitor: "Compare flipbook tools",
};
const ORDER: LandingFamily[] = ["discipline", "task", "publication", "author", "product", "embedding", "competitor"];

export function guideIndex() {
  const seen = new Set<string>();
  const links = [...SEO_LINKS, ...EXTRA].filter(l => !seen.has(l.to) && seen.add(l.to));
  return ORDER.map(family => ({ family, title: FAMILY_TITLES[family], links: links.filter(l => landingFamily(l.to) === family) })).filter(g => g.links.length);
}
