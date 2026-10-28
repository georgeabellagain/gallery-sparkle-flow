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
  /** Made from a GIF: it has no sound, so readers get no speaker button. */
  silent?: true;
}
/** A detail the creator marked on a page. Readers see a magnifier there and can open it large, sharp from the PDF. */
export interface PageSpotlight {
  id: string;
  page: number;
  /** Which half of a spread-sheet page the box sits on. */
  half: "left" | "right";
  /** Top-left corner and size as fractions of the page. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional words shown under the enlarged detail. */
  caption?: string;
  iconX?: number;
  iconY?: number;
  iconScale?: number;
  hideIcon?: boolean;
}
/**
 * A box on a page that takes the reader to another page: typically one per line of a contents page. In the book
 * it turns straight there; in the other reading styles it scrolls or steps to that page.
 */
export interface PageJump {
  id: string;
  page: number;
  /** Which half of a spread-sheet page the box sits on. */
  half: "left" | "right";
  /** Top-left corner and size as fractions of the page. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The 1-based PDF page it goes to. */
  target: number;
}
export const MAX_JUMPS = 60;
export const JUMP_SIZE = { min: 0.02, default: { width: 0.6, height: 0.05 } };
/** Spotlights per portfolio: a few on Free, plenty on Personal. */
export const SPOTLIGHT_LIMITS = { free: 3, personal: 24 } as const;
export const SPOTLIGHT_CAPTION_LIMIT = 140;
export const SPOTLIGHT_SIZE = { min: 0.05, default: 0.35 };
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
  if (v.silent !== undefined && v.silent !== true) return "Choose a valid video.";
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
export function validatePageSpotlight(s: PageSpotlight, pages: number): string | null {
  if (!s || typeof s !== "object" || !key.test(s.id)) return "Choose a valid spotlight.";
  if (!Number.isInteger(s.page) || s.page < 1 || s.page > pages) return "Choose a page in this PDF.";
  if (s.half !== "left" && s.half !== "right") return "Choose a page half.";
  if (s.caption !== undefined && (typeof s.caption !== "string" || s.caption.length > SPOTLIGHT_CAPTION_LIMIT)) return `Keep the caption to ${SPOTLIGHT_CAPTION_LIMIT} characters.`;
  if (s.hideIcon !== undefined && typeof s.hideIcon !== "boolean") return "Choose whether to show the magnifier.";
  if ([s.iconX, s.iconY].some(v => v !== undefined && (!Number.isFinite(v) || v < 0 || v > 1)) || (s.iconScale !== undefined && (!Number.isFinite(s.iconScale) || s.iconScale < 0.5 || s.iconScale > 3))) return "Choose a valid magnifier position and scale.";
  if (![s.x, s.y, s.width, s.height].every(Number.isFinite)) return "Choose a valid spotlight size.";
  if (s.width < SPOTLIGHT_SIZE.min - 1e-9 || s.height < SPOTLIGHT_SIZE.min - 1e-9 || s.width > 1.0001 || s.height > 1.0001) return "Choose a valid spotlight size.";
  if (s.x < -1e-9 || s.y < -1e-9 || s.x + s.width > 1.0001 || s.y + s.height > 1.0001) return "Keep the spotlight on the page.";
  return null;
}
export const readablePageSpotlights = (value: unknown, pages: number): PageSpotlight[] =>
  readable<PageSpotlight>(value, SPOTLIGHT_LIMITS.personal, (s) => !validatePageSpotlight(s, pages));
export const spotlightsForLeaf = (spotlights: PageSpotlight[], leaf: { page: number; half?: "left" | "right" }) =>
  spotlights.filter((s) => s.page === leaf.page && (!leaf.half || s.half === leaf.half));
/** The same leaf-relative box on the full PDF page, for Scroll and Page-by-page. */
export function spotlightsForPage(spotlights: PageSpotlight[], page: number, split: boolean): PageSpotlight[] {
  return spotlights.filter((s) => s.page === page).map((s) => split
    ? { ...s, x: (s.half === "right" ? 0.5 : 0) + s.x / 2, width: s.width / 2 }
    : s);
}
/** Keeps a spotlight box on its page while it is moved or resized. Its shape is free. */
export function placeSpotlight(s: PageSpotlight, x: number, y: number, width: number, height: number): PageSpotlight {
  const w = Math.min(Math.max(SPOTLIGHT_SIZE.min, width), 1), h = Math.min(Math.max(SPOTLIGHT_SIZE.min, height), 1);
  return { ...s, width: w, height: h, x: Math.min(Math.max(0, x), 1 - w), y: Math.min(Math.max(0, y), 1 - h) };
}
/**
 * The part of the full PDF page a spotlight shows, as fractions of that page. A spotlight on a
 * spread-sheet page is stored relative to its half, so it is mapped back onto the whole sheet.
 */
export function spotlightRegion(s: Pick<PageSpotlight, "half" | "x" | "y" | "width" | "height">, split: boolean) {
  return split
    ? { x: (s.half === "right" ? 0.5 : 0) + s.x / 2, y: s.y, width: s.width / 2, height: s.height }
    : { x: s.x, y: s.y, width: s.width, height: s.height };
}
export function validatePageJump(j: PageJump, pages: number): string | null {
  if (!j || typeof j !== "object" || !key.test(j.id)) return "Choose a valid page link.";
  if (!Number.isInteger(j.page) || j.page < 1 || j.page > pages) return "Choose a page in this PDF.";
  if (!Number.isInteger(j.target) || j.target < 1 || j.target > pages) return `Choose a page from 1 to ${pages} to go to.`;
  if (j.half !== "left" && j.half !== "right") return "Choose a page half.";
  if (![j.x, j.y, j.width, j.height].every(Number.isFinite)) return "Choose a valid box.";
  if (j.width < JUMP_SIZE.min - 1e-9 || j.height < JUMP_SIZE.min - 1e-9 || j.width > 1.0001 || j.height > 1.0001) return "Choose a valid box size.";
  if (j.x < -1e-9 || j.y < -1e-9 || j.x + j.width > 1.0001 || j.y + j.height > 1.0001) return "Keep the box on the page.";
  return null;
}
export const readablePageJumps = (value: unknown, pages: number): PageJump[] => readable<PageJump>(value, MAX_JUMPS, (j) => !validatePageJump(j, pages));
export const jumpsForLeaf = (jumps: PageJump[], leaf: { page: number; half?: "left" | "right" }) =>
  jumps.filter((j) => j.page === leaf.page && (!leaf.half || j.half === leaf.half));
/** The same leaf-relative box on the full PDF page, for Scroll and Page-by-page. */
export function jumpsForPage(jumps: PageJump[], page: number, split: boolean): PageJump[] {
  return jumps.filter((j) => j.page === page).map((j) => split ? { ...j, x: (j.half === "right" ? 0.5 : 0) + j.x / 2, width: j.width / 2 } : j);
}
/** Keeps a page link's box on its page while it is moved or resized. Its shape is free. */
export function placeJump(j: PageJump, x: number, y: number, width: number, height: number): PageJump {
  const w = Math.min(Math.max(JUMP_SIZE.min, width), 1), h = Math.min(Math.max(JUMP_SIZE.min, height), 1);
  return { ...j, width: w, height: h, x: Math.min(Math.max(0, x), 1 - w), y: Math.min(Math.max(0, y), 1 - h) };
}
/**
 * A small animated sticker on a page: an arrow, circle, star and so on, drawn from the Lucide icon set (ISC licence,
 * free to use) and moving gently. It sits on the page like a website link: a square, placed by its top-left corner.
 */
export const STICKERS = [
  { id: "arrow-right", label: "Arrow", motion: "nudge" },
  { id: "arrow-down", label: "Arrow down", motion: "bounce" },
  { id: "arrow-up-right", label: "Arrow up", motion: "nudge-up" },
  { id: "corner-right-down", label: "Curved arrow", motion: "bounce" },
  { id: "circle", label: "Circle", motion: "draw" },
  { id: "circle-dot", label: "Target", motion: "pulse" },
  { id: "star", label: "Star", motion: "spin" },
  { id: "sparkles", label: "Sparkle", motion: "twinkle" },
  { id: "heart", label: "Heart", motion: "beat" },
  { id: "check", label: "Tick", motion: "draw" },
  { id: "pointer", label: "Click", motion: "tap" },
  { id: "hand", label: "Wave", motion: "wiggle" },
  { id: "zap", label: "Flash", motion: "flash" },
  { id: "asterisk", label: "Burst", motion: "spin" },
  { id: "eye", label: "Look", motion: "pulse" },
  { id: "plus", label: "Plus", motion: "spin" },
  // For shops and catalogues: sale badges, bags and tags.
  { id: "badge-sale", label: "Sale badge", motion: "pop" },
  { id: "badge-new", label: "New badge", motion: "pop" },
  { id: "badge-hot", label: "Hot badge", motion: "flicker" },
  { id: "percent", label: "Discount", motion: "spin" },
  { id: "shopping-bag", label: "Bag", motion: "bounce" },
  { id: "tag", label: "Price tag", motion: "swing" },
  { id: "gift", label: "Gift", motion: "wiggle" },
  // To draw the eye.
  { id: "bell", label: "Bell", motion: "ring" },
  { id: "megaphone", label: "Announce", motion: "shake" },
  { id: "party", label: "Celebrate", motion: "pop" },
  { id: "flame", label: "Flame", motion: "flicker" },
  { id: "thumbs-up", label: "Thumbs up", motion: "pop" },
  { id: "message", label: "Speech", motion: "pop" },
  { id: "map-pin", label: "Location", motion: "drop" },
  { id: "phone", label: "Call", motion: "ring" },
  { id: "mail", label: "Email", motion: "bounce" },
  { id: "clock", label: "Time", motion: "spin" },
  { id: "arrow-left", label: "Arrow left", motion: "nudge-left" },
  { id: "arrow-up", label: "Arrow up", motion: "rise" },
  { id: "scribble-circle", label: "Hand circle", motion: "draw" },
  { id: "underline", label: "Underline", motion: "draw" },
] as const;
export type StickerId = (typeof STICKERS)[number]["id"];
export type StickerMotion = (typeof STICKERS)[number]["motion"];
export const stickerInfo = (id: string) => STICKERS.find((s) => s.id === id);
export interface PageSticker {
  id: string;
  page: number;
  /** Which half of a spread-sheet page it sits on. */
  half: "left" | "right";
  sticker: StickerId;
  colour: string;
  /** Top-left corner and width as fractions of the page; it is square. */
  x: number;
  y: number;
  size: number;
}
export const MAX_STICKERS = 40;
export const STICKER_SIZE = { min: 0.03, max: 0.5, default: 0.12 };
export const STICKER_COLOURS = ["#e8604c", "#1c1c1c", "#ffffff", "#f2a93b", "#4fa3d1", "#6bbf8a", "#8c79d8", "#e98bb5"];
export function validatePageSticker(s: PageSticker, pages: number): string | null {
  if (!s || typeof s !== "object" || !key.test(s.id)) return "Choose a valid sticker.";
  if (!Number.isInteger(s.page) || s.page < 1 || s.page > pages) return "Choose a page in this PDF.";
  if (s.half !== "left" && s.half !== "right") return "Choose a page half.";
  if (!stickerInfo(s.sticker)) return "Choose a sticker.";
  if (!hex.test(s.colour)) return "Choose a sticker colour.";
  if (![s.x, s.y, s.size].every(Number.isFinite) || s.size < STICKER_SIZE.min - 1e-9 || s.size > STICKER_SIZE.max + 1e-9) return "Choose a valid sticker size.";
  if (s.x < -1e-9 || s.y < -1e-9 || s.x + s.size > 1.0001 || s.y > 1.0001) return "Keep the sticker on the page.";
  return null;
}
export const readablePageStickers = (value: unknown, pages: number): PageSticker[] =>
  readable<PageSticker>(value, MAX_STICKERS, (s) => !validatePageSticker(s, pages));
export const stickersForLeaf = (stickers: PageSticker[], leaf: { page: number; half?: "left" | "right" }) =>
  stickers.filter((s) => s.page === leaf.page && (!leaf.half || s.half === leaf.half));
/** The same leaf-relative square on the full PDF page, for Scroll and Page-by-page. */
export function stickersForPage(stickers: PageSticker[], page: number, split: boolean): PageSticker[] {
  return stickers.filter((s) => s.page === page).map((s) => split ? { ...s, x: (s.half === "right" ? 0.5 : 0) + s.x / 2, size: s.size / 2 } : s);
}
/** Keeps a sticker on its page while it is moved or resized (`ratio` is page height over width). */
export function placeSticker(s: PageSticker, x: number, y: number, size: number, ratio = 1.4): PageSticker {
  const w = Math.min(Math.max(STICKER_SIZE.min, size), STICKER_SIZE.max), h = w / ratio;
  return { ...s, size: w, x: Math.min(Math.max(0, x), 1 - w), y: Math.min(Math.max(0, y), Math.max(0, 1 - h)) };
}
/**
 * A hotspot: something readers press on a page. It looks like a pulsing dot, a labelled tag or a button, and either
 * opens a pop-up card (a product with its picture, price and a shop button, a caption, a YouTube or Vimeo video) or
 * goes straight to a link (a website, an email address or a phone number). Product tags, pop-up frames and
 * call-to-action buttons, as catalogue and brochure makers offer, all in one.
 */
export const HOTSPOT_STYLES = [
  { id: "dot", label: "Pulsing dot" },
  { id: "tag", label: "Tag" },
  { id: "button", label: "Button" },
  { id: "info", label: "Info icon" },
  { id: "video", label: "Video player" },
] as const;
export type HotspotStyle = (typeof HOTSPOT_STYLES)[number]["id"];
export interface PageHotspot {
  id: string;
  page: number;
  half: "left" | "right";
  style: HotspotStyle;
  /** Top-left corner and width as fractions of the page (a dot is square; a tag or button is a pill). */
  x: number;
  y: number;
  size: number;
  colour: string;
  /** Words on a tag or button. */
  label?: string;
  action: "popup" | "link";
  /** The pop-up card. */
  title?: string;
  text?: string;
  price?: string;
  imageKey?: string;
  /** A YouTube or Vimeo address: played in the pop-up, or on the page itself by a video player hotspot. */
  video?: string;
  /** Video player: starts playing (muted) as soon as its page is open; otherwise it plays when pressed. */
  autoplay?: boolean;
  /** Where the link (or the pop-up's button) goes: a website, mailto: or tel:. */
  url?: string;
  buttonLabel?: string;
}
export const MAX_HOTSPOTS = 60;
export const HOTSPOT_SIZE = { min: 0.025, max: 0.9, dot: 0.05, tag: 0.22, button: 0.32, info: 0.05, video: 0.55 };
/** A hotspot's starting width for each look. */
export const hotspotStartSize = (style: HotspotStyle) => HOTSPOT_SIZE[style];
export const HOTSPOT_LIMITS = { label: 40, title: 80, text: 600, price: 24, button: 30 };
/** How tall a hotspot is as a fraction of the page (for keeping it on the page): a dot is square, a pill is short. */
/** (An info icon is round like a dot; a video player is 16:9.) */
export const hotspotHeight = (h: Pick<PageHotspot, "style" | "size">, ratio = 1.4) =>
  (h.style === "dot" || h.style === "info" ? h.size : h.style === "video" ? h.size * 0.5625 : h.size * 0.28) / ratio;
/** A website, email or phone link, made safe: "shop.com/x" becomes https://shop.com/x; anything else is null. */
export function hotspotHref(input: string): string | null {
  const text = (input ?? "").trim();
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text)) return text;
  if (/^[^\s@:/]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
  if (/^tel:\+?[0-9 ()-]{5,24}$/i.test(text)) return text.replace(/\s+/g, "");
  return normaliseUrl(text);
}
/** A YouTube video's still picture (Vimeo gives none without asking its servers), shown before it plays. */
export function videoThumbnail(input: string): string | null {
  const embed = videoEmbedUrl(input);
  const id = embed?.match(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
/** The player address set to play now: inline on phones, muted when it starts by itself (browsers require it). */
export function videoPlayUrl(input: string, muted = false): string | null {
  const embed = videoEmbedUrl(input);
  if (!embed) return null;
  const join = embed.includes("?") ? "&" : "?";
  return `${embed}${join}autoplay=1&playsinline=1${muted ? "&mute=1&muted=1" : ""}${embed.includes("youtube") ? "&rel=0&modestbranding=1" : ""}`;
}
/** The privacy-friendly player address for a YouTube or Vimeo link, or null. */
export function videoEmbedUrl(input: string): string | null {
  try {
    const url = new URL((input ?? "").trim());
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
    if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const v = url.pathname.match(/(\d{5,12})/)?.[1];
      if (v) return `https://player.vimeo.com/video/${v}?dnt=1`;
    }
  } catch { /* not an address */ }
  return null;
}
const within = (v: unknown, max: number) => v === undefined || (typeof v === "string" && v.length <= max);
export function validatePageHotspot(h: PageHotspot, pages: number): string | null {
  if (!h || typeof h !== "object" || !key.test(h.id)) return "Choose a valid hotspot.";
  if (!Number.isInteger(h.page) || h.page < 1 || h.page > pages) return "Choose a page in this PDF.";
  if (h.half !== "left" && h.half !== "right") return "Choose a page half.";
  if (!HOTSPOT_STYLES.some((s) => s.id === h.style)) return "Choose how the hotspot looks.";
  if (h.action !== "popup" && h.action !== "link") return "Choose what the hotspot does.";
  if (!hex.test(h.colour)) return "Choose a hotspot colour.";
  if (!within(h.label, HOTSPOT_LIMITS.label) || !within(h.title, HOTSPOT_LIMITS.title) || !within(h.text, HOTSPOT_LIMITS.text) || !within(h.price, HOTSPOT_LIMITS.price) || !within(h.buttonLabel, HOTSPOT_LIMITS.button)) return "Keep the hotspot's words shorter.";
  if (h.imageKey !== undefined && (typeof h.imageKey !== "string" || !key.test(h.imageKey))) return "Choose a valid picture.";
  if (h.video !== undefined && (typeof h.video !== "string" || !videoEmbedUrl(h.video))) return "Use a YouTube or Vimeo address.";
  if (h.autoplay !== undefined && typeof h.autoplay !== "boolean") return "Choose whether the video starts by itself.";
  if (h.url !== undefined && (typeof h.url !== "string" || hotspotHref(h.url) !== h.url)) return "Use a website, email address or phone number.";
  if (h.action === "link" && !h.url) return "Add where the link goes.";
  if (![h.x, h.y, h.size].every(Number.isFinite) || h.size < HOTSPOT_SIZE.min - 1e-9 || h.size > HOTSPOT_SIZE.max + 1e-9) return "Choose a valid hotspot size.";
  if (h.x < -1e-9 || h.y < -1e-9 || h.x + h.size > 1.0001 || h.y > 1.0001) return "Keep the hotspot on the page.";
  return null;
}
export const readablePageHotspots = (value: unknown, pages: number): PageHotspot[] =>
  readable<PageHotspot>(value, MAX_HOTSPOTS, (h) => !validatePageHotspot(h, pages));
export const hotspotsForLeaf = (hotspots: PageHotspot[], leaf: { page: number; half?: "left" | "right" }) =>
  hotspots.filter((h) => h.page === leaf.page && (!leaf.half || h.half === leaf.half));
/** The same leaf-relative place on the full PDF page, for Scroll and Page-by-page. */
export function hotspotsForPage(hotspots: PageHotspot[], page: number, split: boolean): PageHotspot[] {
  return hotspots.filter((h) => h.page === page).map((h) => split ? { ...h, x: (h.half === "right" ? 0.5 : 0) + h.x / 2, size: h.size / 2 } : h);
}
/** Keeps a hotspot on its page while it is moved or resized. */
export function placeHotspot(h: PageHotspot, x: number, y: number, size: number, ratio = 1.4): PageHotspot {
  const w = Math.min(Math.max(HOTSPOT_SIZE.min, size), HOTSPOT_SIZE.max), height = hotspotHeight({ style: h.style, size: w }, ratio);
  return { ...h, size: w, x: Math.min(Math.max(0, x), 1 - w), y: Math.min(Math.max(0, y), Math.max(0, 1 - height)) };
}
/**
 * A slideshow on a page: a box of your own pictures that changes by itself (fading or sliding) and that readers can
 * step through with arrows or a swipe. Like a photo slideshow element in a catalogue maker.
 */
export interface PageSlideshow {
  id: string;
  page: number;
  half: "left" | "right";
  /** Top-left corner and size as fractions of the page. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The pictures, in order. */
  images: string[];
  /** Seconds each picture shows before the next. */
  interval: number;
  transition: "fade" | "slide";
  /** Fill the box (cropping) or show each picture whole. */
  fit: "cover" | "contain";
}
export const MAX_SLIDESHOWS = 12;
export const MAX_SLIDES = 12;
export const SLIDESHOW_SIZE = { min: 0.08, default: { width: 0.6, height: 0.4 } };
export const SLIDE_INTERVAL = { min: 2, max: 12, default: 4 };
export function validatePageSlideshow(s: PageSlideshow, pages: number): string | null {
  if (!s || typeof s !== "object" || !key.test(s.id)) return "Choose a valid slideshow.";
  if (!Number.isInteger(s.page) || s.page < 1 || s.page > pages) return "Choose a page in this PDF.";
  if (s.half !== "left" && s.half !== "right") return "Choose a page half.";
  if (!Array.isArray(s.images) || s.images.length > MAX_SLIDES || s.images.some((k) => typeof k !== "string" || !key.test(k))) return `Use up to ${MAX_SLIDES} pictures.`;
  if (!Number.isFinite(s.interval) || s.interval < SLIDE_INTERVAL.min || s.interval > SLIDE_INTERVAL.max) return "Choose how long each picture shows.";
  if (s.transition !== "fade" && s.transition !== "slide") return "Choose how pictures change.";
  if (s.fit !== "cover" && s.fit !== "contain") return "Choose how pictures fit.";
  if (![s.x, s.y, s.width, s.height].every(Number.isFinite)) return "Choose a valid slideshow size.";
  if (s.width < SLIDESHOW_SIZE.min - 1e-9 || s.height < SLIDESHOW_SIZE.min - 1e-9 || s.width > 1.0001 || s.height > 1.0001) return "Choose a valid slideshow size.";
  if (s.x < -1e-9 || s.y < -1e-9 || s.x + s.width > 1.0001 || s.y + s.height > 1.0001) return "Keep the slideshow on the page.";
  return null;
}
export const readablePageSlideshows = (value: unknown, pages: number): PageSlideshow[] =>
  readable<PageSlideshow>(value, MAX_SLIDESHOWS, (s) => !validatePageSlideshow(s, pages));
export const slideshowsForLeaf = (slideshows: PageSlideshow[], leaf: { page: number; half?: "left" | "right" }) =>
  slideshows.filter((s) => s.page === leaf.page && (!leaf.half || s.half === leaf.half));
/** The same leaf-relative box on the full PDF page, for Scroll and Page-by-page. */
export function slideshowsForPage(slideshows: PageSlideshow[], page: number, split: boolean): PageSlideshow[] {
  return slideshows.filter((s) => s.page === page).map((s) => split ? { ...s, x: (s.half === "right" ? 0.5 : 0) + s.x / 2, width: s.width / 2 } : s);
}
/** Keeps a slideshow's box on its page while it is moved or resized. Its shape is free. */
export function placeSlideshow(s: PageSlideshow, x: number, y: number, width: number, height: number): PageSlideshow {
  const w = Math.min(Math.max(SLIDESHOW_SIZE.min, width), 1), h = Math.min(Math.max(SLIDESHOW_SIZE.min, height), 1);
  return { ...s, width: w, height: h, x: Math.min(Math.max(0, x), 1 - w), y: Math.min(Math.max(0, y), 1 - h) };
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
