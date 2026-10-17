import { FREE_UPLOAD_LIMIT_MB, MAX_PORTFOLIOS, PERSONAL_UPLOAD_LIMIT_MB, PRICE } from "./store";

/**
 * One source of truth for plan copy, so the homepage, pricing page, upgrade
 * dialog and dashboard never disagree. Every Personal item here is enforced in
 * code (see premium-appearance.ts, entitlements.server.ts and personalActive).
 */
const pounds = (price: string) => Number(price.replace(/[^0-9.]/g, ""));
const yearlyTotal = pounds(PRICE.year), monthlyTotal = pounds(PRICE.month) * 12;

/** Whole-percent saving of yearly over twelve monthly payments. */
export const YEARLY_SAVING = Math.round((1 - yearlyTotal / monthlyTotal) * 100);
/** The yearly plan expressed per month, e.g. "£2.08". */
export const YEARLY_PER_MONTH = `£${(yearlyTotal / 12).toFixed(2)}`;

export const FREE_FEATURES = [
  `One portfolio, PDFs up to ${FREE_UPLOAD_LIMIT_MB} MB`,
  "3D Studio flipbook, Scroll and Page-by-page readers",
  "Permanent link, QR code and website embed",
  "Clickable website links and page tabs",
  "Replace your PDF without breaking the link",
  "Basic visit statistics",
];

/** Ordered by what people pay for first: identity, control, polish, then room. */
export const PERSONAL_FEATURES = [
  "Your own address: portfolia.site/yourname",
  "Password protection and link expiry",
  "No Portfolia credit on your portfolio",
  `Up to ${MAX_PORTFOLIOS} portfolios, PDFs up to ${PERSONAL_UPLOAD_LIMIT_MB} MB`,
  "Every lighting set and backdrop, plus your own images",
  "Downloadable CV and custom profile styling",
  "Export your flipbook as a 1080p HD video",
];

export type ComparisonValue = boolean | string;
export const PLAN_COMPARISON: { group: string; rows: { label: string; free: ComparisonValue; personal: ComparisonValue }[] }[] = [
  {
    group: "Hosting",
    rows: [
      { label: "Portfolios", free: "1", personal: String(MAX_PORTFOLIOS) },
      { label: "PDF size", free: `${FREE_UPLOAD_LIMIT_MB} MB`, personal: `${PERSONAL_UPLOAD_LIMIT_MB} MB` },
      { label: "Permanent link (portfolia.site/p/…)", free: true, personal: true },
      { label: "Your own address (portfolia.site/yourname)", free: false, personal: true },
      { label: "Replace your PDF, keep the link", free: true, personal: true },
    ],
  },
  {
    group: "Presentation",
    rows: [
      { label: "3D Studio flipbook, Simple, Scroll and Page by page", free: true, personal: true },
      { label: "Studio lighting sets", free: "4", personal: "All 15" },
      { label: "Backdrops", free: "2", personal: "All, plus uploads" },
      { label: "Website links and page tabs", free: true, personal: true },
      { label: "Custom profile styling", free: false, personal: true },
      { label: "Downloadable CV", free: false, personal: true },
      { label: "Portfolia credit", free: "Small credit", personal: "Removed" },
    ],
  },
  {
    group: "Sharing",
    rows: [
      { label: "QR code and website embed", free: true, personal: true },
      { label: "Password protection", free: false, personal: true },
      { label: "Link expiry date", free: false, personal: true },
      { label: "1080p HD flipbook video", free: false, personal: true },
      { label: "Visit statistics", free: "Basic", personal: "Basic" },
    ],
  },
];

export const PLAN_FAQ = [
  { q: "Is the Free plan really free?", a: "Yes. No card and no trial timer. Free keeps one portfolio online with a permanent link for as long as you like." },
  { q: "Do I need an account to try it?", a: "No. Drop a PDF on the homepage to preview it in every reader. Sign in only when you want to save and publish." },
  { q: "Can I change plan later?", a: "Yes. Move between monthly and yearly billing, or back to Free, at any time from your dashboard." },
  { q: "What happens if I cancel Personal?", a: "Access continues to the end of the paid period. Your portfolios keep their permanent /p/ links and nothing is deleted." },
  { q: "Will links I have already shared keep working if I upgrade?", a: "Yes. Your permanent /p/ link never changes. Your personalised address is added alongside it." },
  { q: "How do people find my portfolio?", a: "Share your link or QR code, embed it on your own site, or opt in to search engine indexing for each portfolio." },
];
