/** Page tabs and website links: small extras that sit on a page of the book. Pure data and validation. */
export interface PageTag {
  id: string;
  /** 1-based PDF page the tab is attached to. */
  page: number;
  label: string;
  colour: string;
}
export interface PageLink {
  id: string;
  page: number;
  /** Which half of a spread-sheet page the link sits on. */
  half: "left" | "right";
  url: string;
  /** Optional caption shown under the logo. */
  label?: string;
  /** Position of the link's top-left corner as a fraction of the page. */
  x: number;
  y: number;
  /** Width as a fraction of the page. The logo is square. */
  size: number;
  /** A logo the creator chose instead of the website's own. */
  iconKey?: string;
}
export const MAX_TAGS = 24;
export const MAX_LINKS = 24;
export const TAG_LABEL_LIMIT = 24;
export const LINK_SIZE = { min: 0.02, max: 0.4, default: 0.1 };
export const TAG_COLOURS = ["#e8604c", "#f2a93b", "#f4d35e", "#6bbf8a", "#4fa3d1", "#8c79d8", "#e98bb5", "#3b3a36"];
const key = /^[a-zA-Z0-9_.-]{1,120}$/;
const hex = /^#[a-fA-F0-9]{6}$/;

/** Turns what a creator typed into a safe https/http address, or null. "behance.net/me" becomes "https://behance.net/me". */
export function normaliseUrl(input: string): string | null {
  const text = (input ?? "").trim();
  if (!text || text.length > 500 || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^/]*:\d+/.test(text) ? text : `https://${text.replace(/^\/\//, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
/** The website's own logo, served from our own address (the server fetches it, so visitors never contact a third party). */
export function siteIconUrl(url: string): string {
  return `/api/public/favicon?host=${encodeURIComponent(hostOf(url))}`;
}
/** A readable name for a link without a caption: "behance.net". */
export function linkName(link: Pick<PageLink, "url" | "label">): string {
  return link.label?.trim() || hostOf(link.url);
}
export function validatePageTag(t: PageTag, pages: number): string | null {
  if (!t || typeof t !== "object" || !key.test(t.id)) return "Choose a valid tag.";
  if (!Number.isInteger(t.page) || t.page < 1 || t.page > pages) return "Choose a page in this PDF.";
  if (typeof t.label !== "string" || t.label.length > TAG_LABEL_LIMIT) return `Keep tag text to ${TAG_LABEL_LIMIT} characters.`;
  if (!hex.test(t.colour)) return "Choose a tag colour.";
  return null;
}
export function validatePageLink(l: PageLink, pages: number): string | null {
  if (!l || typeof l !== "object" || !key.test(l.id)) return "Choose a valid link.";
  if (!Number.isInteger(l.page) || l.page < 1 || l.page > pages) return "Choose a page in this PDF.";
  if (l.half !== "left" && l.half !== "right") return "Choose a page half.";
  if (typeof l.url !== "string" || normaliseUrl(l.url) !== l.url) return "Enter a web address that starts with http or https.";
  if (l.label !== undefined && (typeof l.label !== "string" || l.label.length > 40)) return "Keep the link caption short.";
  if (l.iconKey !== undefined && (typeof l.iconKey !== "string" || !key.test(l.iconKey))) return "Choose a valid logo.";
  if (![l.x, l.y, l.size].every(Number.isFinite) || l.size < LINK_SIZE.min - 1e-9 || l.size > LINK_SIZE.max + 1e-9) return "Choose a valid link size.";
  if (l.x < 0 || l.y < 0 || l.x + l.size > 1.0001 || l.y > 1.0001) return "Keep the link on the page.";
  return null;
}
function readable<T extends { id: string }>(value: unknown, max: number, ok: (v: T) => boolean): T[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return (value as T[])
    .filter((v) => {
      if (!ok(v) || ids.has(v.id)) return false;
      ids.add(v.id);
      return true;
    })
    .slice(0, max);
}
export const readablePageTags = (value: unknown, pages: number): PageTag[] => readable<PageTag>(value, MAX_TAGS, (t) => !validatePageTag(t, pages));
export const readablePageLinks = (value: unknown, pages: number): PageLink[] => readable<PageLink>(value, MAX_LINKS, (l) => !validatePageLink(l, pages));

/** Tabs are spaced along the book's edge in page order, so several tags never sit on top of each other. */
export function tabSlots(tags: PageTag[]): Array<PageTag & { slot: number; of: number }> {
  const sorted = [...tags].sort((a, b) => a.page - b.page);
  return sorted.map((t, slot) => ({ ...t, slot, of: sorted.length }));
}
/** Which page a link sits on, for a leaf of the book. */
export const linksForLeaf = (links: PageLink[], leaf: { page: number; half?: "left" | "right" }) =>
  links.filter((l) => l.page === leaf.page && (!leaf.half || l.half === leaf.half));
export const tagsForLeaf = (tags: PageTag[], leaf: { page: number; half?: "left" | "right" }) =>
  tags.filter((t) => t.page === leaf.page);
/** Pointer position as a fraction of the page, clamped so a link stays fully on it (`ratio` is page height over width). */
export function placeLink(l: PageLink, x: number, y: number, ratio = 1.4): PageLink {
  return { ...l, x: Math.min(Math.max(0, x), 1 - l.size), y: Math.min(Math.max(0, y), Math.max(0, 1 - l.size / ratio)) };
}
