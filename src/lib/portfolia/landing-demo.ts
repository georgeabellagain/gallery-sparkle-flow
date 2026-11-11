import { DISCIPLINE_PAGES } from "./seo-pages";
import { TASK_PAGES } from "./task-pages";
import { COMPETITORS } from "./competitors";
import { YEARLY_PER_MONTH } from "./plans";

/**
 * Which live example and which wording each landing page opens with (plan 3). One place, so a new page only needs
 * a decision here, and tests can check every route.
 */
export type HeroDemo = "portfolio" | "product";
export type LandingFamily = "discipline" | "task" | "competitor" | "embedding" | "author" | "product" | "publication";

/** Author pages sell a book, so they show the Pink product (owner decision 1, default). */
const AUTHOR_PAGES = ["/book-marketing", "/book-mockup-generator", "/hdri-book-visualisation"] as const;
const PRODUCT_PAGES = ["/digital-product-studio", "/etsy-digital-product-preview", "/digital-zine-publishing"] as const;
const PUBLICATION_PAGES = ["/zine-flipbook", "/magazine-flipbook", "/lookbook-maker"] as const;

const slug = (path: string) => path.replace(/^\/+|\/+$/g, "");

export function landingFamily(path: string): LandingFamily {
  const p = `/${slug(path)}`, s = slug(path);
  if ((AUTHOR_PAGES as readonly string[]).includes(p)) return "author";
  if ((PRODUCT_PAGES as readonly string[]).includes(p)) return "product";
  if ((PUBLICATION_PAGES as readonly string[]).includes(p)) return "publication";
  if (s.startsWith("embed-flipbook-in-")) return "embedding";
  if (p === "/flipbook-alternatives" || COMPETITORS.some(c => c.slug === s)) return "competitor";
  if (TASK_PAGES[s] || p === "/free-pdf-flipbook") return "task";
  if (DISCIPLINE_PAGES[s]) return "discipline";
  return "discipline";
}

export function heroDemoFor(path: string): HeroDemo {
  const family = landingFamily(path);
  return family === "author" || family === "product" ? "product" : "portfolio";
}

/** Every page that opens with the Pink product; the test checks the lists stay in step with the routes. */
export const PRODUCT_DEMO_PATHS: readonly string[] = [...AUTHOR_PAGES, ...PRODUCT_PAGES];

/** An introduction longer than this does not fit the hero's two lines; the page prints it in full below the hero. */
export const HERO_INTRO_MAX_CHARS = 125;

const NO_SIGN_UP = "No sign-up to preview";
// Each tick is checked against plans.ts and products/plan.ts: Free publishes one PDF up to 30 MB, replacing a PDF keeps
// its address, yearly Personal is YEARLY_PER_MONTH a month, and publishing a product needs Personal or Business.
export const PORTFOLIO_TICKS = [NO_SIGN_UP, "Free forever for one portfolio", "Looks great on phones"];
export const PRODUCT_TICKS = ["Try it free, publish with Personal", "Private edition for customers", "Works with your existing shop"];

const COPY: Record<LandingFamily, { eyebrow: string; ticks: string[] }> = {
  discipline: { eyebrow: "Free PDF portfolio hosting", ticks: [NO_SIGN_UP, "One link, QR code or embed", "Looks great on phones"] },
  task: { eyebrow: "Free PDF to link", ticks: [NO_SIGN_UP, "Free for one PDF up to 30 MB", "Replace the file, keep the link"] },
  competitor: { eyebrow: "A simpler flipbook for portfolios", ticks: ["Free website embed", "No watermark on your pages", `From ${YEARLY_PER_MONTH} a month, billed yearly`] },
  embedding: { eyebrow: "Embed a PDF flipbook", ticks: ["Free embed code", "Works in Squarespace, Wix and Notion", NO_SIGN_UP] },
  author: { eyebrow: "Book previews and mockups", ticks: ["Show sample pages", "Link to where it’s sold", "Stage listing photos and videos"] },
  product: { eyebrow: "Digital Product Studio", ticks: PRODUCT_TICKS },
  publication: { eyebrow: "Free PDF flipbook", ticks: [NO_SIGN_UP, "Free for one PDF up to 30 MB", "Looks great on phones"] },
};

/** The task pages that name their job get a more exact eyebrow than "Free PDF to link". */
const TASK_EYEBROWS: Record<string, string> = {
  "free-pdf-flipbook": "Free PDF flipbook",
  "host-pdf": "Free PDF hosting",
  "pdf-to-website": "Free PDF to website",
  "pdf-qr-code": "Free PDF QR code",
  "share-pdf-online": "Free PDF sharing",
  "send-large-pdf": "Send a large PDF",
  "canva-flipbook": "Free Canva PDF flipbook",
  "ucas-portfolio": "Free UCAS portfolio link",
  "how-to-send-a-portfolio": "Free portfolio link",
};

export function landingCopy(path: string) {
  const family = landingFamily(path), base = COPY[family];
  return { eyebrow: family === "task" ? TASK_EYEBROWS[slug(path)] ?? base.eyebrow : base.eyebrow, ticks: base.ticks };
}

/**
 * Still pictures of the same book, shown until the live example is ready. Plan 2 adds `book-three-quarter` and
 * `product-preview`; until those files exist the hero shows the loader instead.
 */
export const HERO_STILLS: Record<HeroDemo, { src: string; width: number; height: number } | null> = { portfolio: null, product: null };

/** At most eight related guides for a page: the same family first (discipline, task, alternative, embedding). */
export function relatedGuides<T extends { to: string }>(path: string, links: T[], max = 8): T[] {
  const family = landingFamily(path), others = links.filter(l => l.to !== path);
  return [...others.filter(l => landingFamily(l.to) === family), ...others.filter(l => landingFamily(l.to) !== family)].slice(0, max);
}