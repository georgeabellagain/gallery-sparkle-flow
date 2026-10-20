/**
 * Pre-made page pictures. When a portfolio is published (or its PDF replaced) the creator's browser draws every
 * page once as a WebP (JPEG where the browser cannot encode WebP) and stores them beside the PDF, in
 * portfolio-files/<uid>/<pdfKey>_pages/<page>-<size>.<format>. Visitors then open on two small pictures instead of
 * parsing the PDF; the PDF is still streamed afterwards for selectable text and deep zoom.
 *
 * This module is shared by the browser and the server, so it holds only the manifest, its checks and the keys.
 */

/** Long-side sizes, in pixels: phones and desktops. */
export const PAGE_IMAGE_SIZES = [1600, 2560] as const;
export type PageImageSize = (typeof PAGE_IMAGE_SIZES)[number];
export type PageImageFormat = "webp" | "jpg";
/** No picture may exceed what every phone's graphics card accepts as a texture. */
export const PAGE_IMAGE_MAX_SIDE = 4096;
export const MAX_IMAGE_PAGES = 1000;

/** A web link the PDF itself carries, as fractions of the page (top-left origin). */
export interface PageImageLink { url: string; x: number; y: number; w: number; h: number }

export interface PageImagePage {
  /** The page's size in PDF points, rotation applied (what pdf.js reports at scale 1). */
  w: number;
  h: number;
  /** Pixel width and height of each picture, in the order of PageImages.sizes. */
  px: [number, number][];
  links?: PageImageLink[];
  /** The page has selectable text, stored beside its pictures (<n>-text.json). */
  text?: true;
}

/** A page's selectable text as pdf.js's TextLayer reads it, plus the PDF page box it is measured in. */
export interface StoredPageText {
  v: 1;
  /** The page's view box in PDF points [x0, y0, x1, y1] and its rotation. */
  view: [number, number, number, number];
  rotate: number;
  items: unknown[];
  styles: Record<string, unknown>;
  lang: string | null;
}

export interface PageImages {
  v: 1;
  /** The PDF these pictures were drawn from. Pictures of an older PDF are never shown for a new one. */
  pdfKey: string;
  format: PageImageFormat;
  sizes: PageImageSize[];
  pages: PageImagePage[];
  /** Text files were made for this book: a page without `text` has none, so the PDF is never opened for it. */
  text?: true;
  createdAt: number;
}

const KEY = /^[a-zA-Z0-9_.-]+$/;
const PAGE_KEY = /^[a-zA-Z0-9_.-]+_pages\/[1-9][0-9]{0,3}-((1600|2560)\.(webp|jpg)|text\.json)$/;

/** Stored file keys are flat names, except page pictures, which live in their PDF's own folder. */
export function safeAssetKey(key: string): boolean {
  return KEY.test(key) || PAGE_KEY.test(key);
}

export const pageImagesFolder = (pdfKey: string) => `${pdfKey}_pages`;
export const pageImageKey = (pdfKey: string, page: number, size: PageImageSize, format: PageImageFormat) =>
  `${pageImagesFolder(pdfKey)}/${page}-${size}.${format}`;
export const pageTextKey = (pdfKey: string, page: number) => `${pageImagesFolder(pdfKey)}/${page}-text.json`;

/**
 * Where each picture is drawn, so its long side is `size` pixels. A landscape page is usually a two-page spread
 * that the flipbook shows as two leaves, so each half gets that detail. Nothing exceeds PAGE_IMAGE_MAX_SIDE.
 */
export function pageImagePixels(w: number, h: number, size: number): [number, number] {
  const leafLong = w > h ? Math.max(w / 2, h) : Math.max(w, h);
  const scale = Math.min(size / leafLong, PAGE_IMAGE_MAX_SIDE / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

const finite = (n: unknown, min = 0, max = Infinity): n is number => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const safeUrl = (u: unknown): u is string => typeof u === "string" && u.length <= 2048 && /^(https?:|mailto:)/i.test(u);

/** A manifest that belongs to this exact PDF and is well formed, or null. Portfolio JSON is owner-controlled. */
export function readablePageImages(pdf?: { blobKey: string; pages: number; pageImages?: unknown } | null): PageImages | null {
  const m = pdf?.pageImages as Partial<PageImages> | undefined;
  if (!pdf || !m || m.v !== 1 || m.pdfKey !== pdf.blobKey || !KEY.test(pdf.blobKey)) return null;
  if (m.format !== "webp" && m.format !== "jpg") return null;
  if (m.text !== undefined && m.text !== true) return null;
  if (!Array.isArray(m.sizes) || !m.sizes.length || m.sizes.some((s) => !PAGE_IMAGE_SIZES.includes(s)) || new Set(m.sizes).size !== m.sizes.length) return null;
  if (!Array.isArray(m.pages) || m.pages.length !== pdf.pages || !m.pages.length || m.pages.length > MAX_IMAGE_PAGES) return null;
  for (const page of m.pages) {
    if (!page || !finite(page.w, 1, 20000) || !finite(page.h, 1, 20000)) return null;
    if (!Array.isArray(page.px) || page.px.length !== m.sizes.length || page.px.some((p) => !Array.isArray(p) || !finite(p[0], 1, PAGE_IMAGE_MAX_SIDE) || !finite(p[1], 1, PAGE_IMAGE_MAX_SIDE))) return null;
    if (page.text !== undefined && page.text !== true) return null;
    if (page.links !== undefined && (!Array.isArray(page.links) || page.links.length > 200 || page.links.some((l) => !l || !safeUrl(l.url) || ![l.x, l.y, l.w, l.h].every((v) => finite(v, -0.01, 1.01))))) return null;
  }
  return m as PageImages;
}

/** Every stored picture of a manifest, whether or not it matches the current PDF (used to clean up after it). */
export function pageImageKeys(pdf?: { pageImages?: unknown } | null): string[] {
  const m = pdf?.pageImages as Partial<PageImages> | undefined;
  if (!m || typeof m.pdfKey !== "string" || !KEY.test(m.pdfKey) || (m.format !== "webp" && m.format !== "jpg") || !Array.isArray(m.sizes) || !Array.isArray(m.pages)) return [];
  const sizes = m.sizes.filter((s): s is PageImageSize => PAGE_IMAGE_SIZES.includes(s));
  const count = Math.min(m.pages.length, MAX_IMAGE_PAGES);
  return Array.from({ length: count }, (_, i) => [
    ...sizes.map((s) => pageImageKey(m.pdfKey!, i + 1, s, m.format!)),
    ...((m.pages![i] as PageImagePage | undefined)?.text === true ? [pageTextKey(m.pdfKey!, i + 1)] : []),
  ]).flat();
}

/** The pictures a visitor may load: only those of the PDF that is published now. */
export function currentPageImageKeys(pdf?: { blobKey: string; pages: number; pageImages?: unknown } | null): string[] {
  return readablePageImages(pdf) ? pageImageKeys(pdf) : [];
}

/** The smallest picture that covers `needLong` device pixels (with a little slack), else the largest. */
export function pickPageImage(page: PageImagePage, needLong: number): number {
  let best = page.px.length - 1;
  let bestLong = Infinity;
  page.px.forEach(([w, h], i) => {
    const long = Math.max(w, h);
    if (long >= needLong * 0.9 && long < bestLong) { best = i; bestLong = long; }
  });
  if (bestLong === Infinity) best = page.px.reduce((b, [w, h], i) => (Math.max(w, h) > Math.max(...page.px[b]!) ? i : b), 0);
  return best;
}

/** Pixels per PDF point of the most detailed picture of a page: the flipbook's image-detail check. */
export function pageImageDensity(m: PageImages, page = 1): number {
  const p = m.pages[Math.min(m.pages.length, Math.max(1, page)) - 1];
  if (!p) return 0;
  return Math.max(...p.px.map(([w]) => w / p.w));
}
