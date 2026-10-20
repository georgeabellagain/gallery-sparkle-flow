import { NOTE_FONT_IDS, type NoteFont } from "./foldouts";
/** Page tabs and website links: small extras that sit on a page of the book. Pure data and validation. */
export interface PageTag {
  id: string;
  /** 1-based PDF page the tab is attached to. */
  page: number;
  label: string;
  colour: string;
  /** Omitted preserves the original tab typeface. */
  font?: NoteFont;
  fontSize?: number;
  /** Centre along the page edge: 0 is top, 1 is bottom. Omitted keeps automatic spacing. */
  position?: number;
  /** Live editor tab height multiplier. */
  scale?: number;
}
export interface PageLink {
  id: string;
  page: number;
  /** Which half of a spread-sheet page the link sits on. */
  half: "left" | "right";
  url: string;
  /** Optional caption shown under the logo. */
  label?: string;
  fontSize?: number;
  /** Position of the link's top-left corner as a fraction of the page. */
  x: number;
  y: number;
  /** Width as a fraction of the page. The logo is square. */
  size: number;
  /** A logo the creator chose instead of the website's own. */
  iconKey?: string;
}
/** A video printed on a page (Personal). It plays inside its box on the paper; its first frame is the still. */
export interface PageVideo {
  id: string;
  page: number;
  /** Which half of a spread-sheet page the video sits on. */
  half: "left" | "right";
  /** Top-left corner and size as fractions of the page. The editor keeps width/height at the video's shape. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The video's width over its height (pixels), used to keep its shape when resized. */
  aspect: number;
  blobKey: string;
  /** First frame as a JPEG: printed on the page, and shown where motion is off or the video can't play. */
  posterKey: string;
  mime: "video/mp4" | "video/webm";
  bytes: number;
  name?: string;
}
export const MAX_VIDEOS = 6;
export const VIDEO_MAX_MB = 40;
export const VIDEO_WIDTH = { min: 0.1, max: 1, default: 0.6 };
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
  if (t.scale !== undefined && (!Number.isFinite(t.scale) || t.scale < .5 || t.scale > 2)) return "Choose a tab scale from 50% to 200%.";
  if (t.fontSize !== undefined && (!Number.isFinite(t.fontSize) || t.fontSize < 25 || t.fontSize > 300)) return "Choose a tab font size from 25% to 300%.";
  if (t.font !== undefined && !(NOTE_FONT_IDS as readonly unknown[]).includes(t.font)) return "Choose a tab font.";
  if (t.position !== undefined && (!Number.isFinite(t.position) || t.position < 0 || t.position > 1)) return "Keep the tab on the page edge.";
  return null;
}
export function validatePageLink(l: PageLink, pages: number): string | null {
  if (!l || typeof l !== "object" || !key.test(l.id)) return "Choose a valid link.";
  if (!Number.isInteger(l.page) || l.page < 1 || l.page > pages) return "Choose a page in this PDF.";
  if (l.half !== "left" && l.half !== "right") return "Choose a page half.";
  if (typeof l.url !== "string" || normaliseUrl(l.url) !== l.url) return "Enter a web address that starts with http or https.";
  if (l.label !== undefined && (typeof l.label !== "string" || l.label.length > 40)) return "Keep the link caption short.";
  if (l.fontSize !== undefined && (!Number.isFinite(l.fontSize) || l.fontSize < 25 || l.fontSize > 300)) return "Choose a caption font size from 25% to 300%.";
  if (l.iconKey !== undefined && (typeof l.iconKey !== "string" || !key.test(l.iconKey))) return "Choose a valid logo.";
  if (![l.x, l.y, l.size].every(Number.isFinite) || l.size < LINK_SIZE.min - 1e-9 || l.size > LINK_SIZE.max + 1e-9) return "Choose a valid link size.";
  if (l.x < 0 || l.y < 0 || l.x + l.size > 1.0001 || l.y > 1.0001) return "Keep the link on the page.";
  return null;
}
/** Height of a video box as a fraction of the page, from its width (`ratio` is page height over width). */
export const videoHeight = (v: Pick<PageVideo, "width" | "aspect">, ratio: number) => v.width / (v.aspect * ratio);
export function validatePageVideo(v: PageVideo, pages: number): string | null {
  if (!v || typeof v !== "object" || !key.test(v.id)) return "Choose a valid video.";
  if (!Number.isInteger(v.page) || v.page < 1 || v.page > pages) return "Choose a page in this PDF.";
  if (v.half !== "left" && v.half !== "right") return "Choose a page half.";
  if (typeof v.blobKey !== "string" || !key.test(v.blobKey) || typeof v.posterKey !== "string" || !key.test(v.posterKey)) return "Choose a valid video file.";
  if (v.mime !== "video/mp4" && v.mime !== "video/webm") return "Use an MP4 or WebM video.";
  if (!Number.isFinite(v.bytes) || v.bytes <= 0 || v.bytes > VIDEO_MAX_MB * 1048576) return `Use a video up to ${VIDEO_MAX_MB} MB.`;
  if (v.name !== undefined && (typeof v.name !== "string" || v.name.length > 120)) return "Choose a shorter file name.";
  if (![v.x, v.y, v.width, v.height, v.aspect].every(Number.isFinite) || v.aspect < 0.2 || v.aspect > 5) return "Choose a valid video shape.";
  if (v.width < VIDEO_WIDTH.min - 1e-9 || v.width > VIDEO_WIDTH.max + 1e-9 || v.height <= 0 || v.height > 1.0001) return "Choose a valid video size.";
  if (v.x < -1e-9 || v.y < -1e-9 || v.x + v.width > 1.0001 || v.y + v.height > 1.0001) return "Keep the video on the page.";
  return null;
}
/** One moving video per page side keeps phones smooth; validation of the list enforces it. */
export function readablePageVideos(value: unknown, pages: number): PageVideo[] {
  const sides = new Set<string>();
  return readable<PageVideo>(value, MAX_VIDEOS, (v) => {
    if (validatePageVideo(v, pages)) return false;
    const side = `${v.page}:${v.half}`;
    if (sides.has(side)) return false;
    sides.add(side);
    return true;
  });
}
export const videosForLeaf = (videos: PageVideo[], leaf: { page: number; half?: "left" | "right" }) =>
  videos.filter((v) => v.page === leaf.page && (!leaf.half || v.half === leaf.half));
/** The same leaf-relative box on the full PDF page, for Scroll and Page-by-page. */
export function videosForPage(videos: PageVideo[], page: number, split: boolean): PageVideo[] {
  return videos.filter((v) => v.page === page).map((v) => split
    ? { ...v, x: (v.half === "right" ? 0.5 : 0) + v.x / 2, width: v.width / 2 }
    : v);
}
/** Keeps a video box on its page while it is moved or resized, at the video's own shape. */
export function placeVideo(v: PageVideo, x: number, y: number, width: number, ratio = 1.4): PageVideo {
  const w = Math.min(Math.max(VIDEO_WIDTH.min, width), VIDEO_WIDTH.max, v.aspect * ratio);
  const h = videoHeight({ width: w, aspect: v.aspect }, ratio);
  return { ...v, width: w, height: h, x: Math.min(Math.max(0, x), 1 - w), y: Math.min(Math.max(0, y), Math.max(0, 1 - h)) };
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
/** The same leaf-relative links, aligned on the full PDF page in Scroll and Page-by-page. */
export function linksForPage(links: PageLink[], page: number, split: boolean): PageLink[] {
  return links.filter((l) => l.page === page).map((l) => split
    ? { ...l, x: (l.half === "right" ? 0.5 : 0) + l.x / 2, size: l.size / 2 }
    : l);
}
export const tagsForLeaf = (tags: PageTag[], leaf: { page: number; half?: "left" | "right" }) =>
  tags.filter((t) => t.page === leaf.page);
/** Pointer position as a fraction of the page, clamped so a link stays fully on it (`ratio` is page height over width). */
export function placeLink(l: PageLink, x: number, y: number, ratio = 1.4): PageLink {
  return { ...l, x: Math.min(Math.max(0, x), 1 - l.size), y: Math.min(Math.max(0, y), Math.max(0, 1 - l.size / ratio)) };
}
