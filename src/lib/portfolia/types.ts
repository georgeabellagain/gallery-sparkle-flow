/** Portfolia prototype data model. Everything lives in the browser. */

export type LayoutId = "paged" | "scroll" | "grid" | "masonry" | "book";

export const LAYOUTS: { id: LayoutId; name: string; blurb: string }[] = [
  {
    id: "paged",
    name: "Paged presentation",
    blurb: "One page at a time with previous/next and keyboard arrows.",
  },
  {
    id: "scroll",
    name: "Continuous scroll",
    blurb: "Work flows down the page and loads as the visitor descends.",
  },
  { id: "grid", name: "Grid", blurb: "A regular, even thumbnail grid." },
  {
    id: "masonry",
    name: "Masonry",
    blurb: "Varied heights that keep every image's own proportions.",
  },
  {
    id: "book",
    name: "Page-turn book",
    blurb: "Drag the bottom-right corner to turn the page.",
  },
];

export type Visibility = "draft" | "unlisted" | "discoverable";

export type Discipline =
  | "Architecture"
  | "Photography"
  | "Graphic design"
  | "Fine art"
  | "Illustration"
  | "Other";

export const DISCIPLINES: Discipline[] = [
  "Architecture",
  "Photography",
  "Graphic design",
  "Fine art",
  "Illustration",
  "Other",
];

/** Asset metadata. Bytes live in IndexedDB (`blobKey`) or are bundled (`url`). */
export interface AssetMeta {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  /** Bundled demo asset served from the app build. */
  url?: string;
  /** Key of the original bytes in IndexedDB. Originals are never overwritten. */
  blobKey?: string;
  /** For PDF page renders: the original PDF asset id. */
  sourcePdfId?: string;
  pageNumber?: number;
  /** True when this asset was cropped out of another asset. */
  croppedFrom?: string;
  createdAt: number;
}

export interface ImageDetails {
  title?: string;
  description?: string;
  date?: string;
  medium?: string;
  dimensions?: string;
  credits?: string;
  custom?: { id: string; label: string; value: string }[];
  links?: { id: string; label: string; url: string }[];
}

export interface Hotspot {
  id: string;
  /** Normalised 0-1 rectangle, so it stays aligned at any render size. */
  x: number;
  y: number;
  w: number;
  h: number;
  action: "viewer" | "link";
  href?: string;
  label?: string;
  details?: ImageDetails;
  /** Optional cropped asset to show in the viewer instead of the whole page. */
  assetId?: string;
}

export type ElementKind = "image" | "text";

/** A freely positioned element inside a page composition or over a PDF page. */
export interface PageElement {
  id: string;
  kind: ElementKind;
  /** Percentages of the page box. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
  /** image */
  assetId?: string;
  alt?: string;
  details?: ImageDetails;
  focal?: { x: number; y: number };
  crop?: { x: number; y: number; w: number; h: number };
  href?: string;
  /** text */
  text?: string;
  style?: TextStyle;
}

export interface TextStyle {
  font?: string;
  size?: number;
  weight?: number;
  align?: "left" | "center" | "right";
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  italic?: boolean;
}

interface ItemBase {
  id: string;
  hidden?: boolean;
  locked?: boolean;
  opacity?: number;
}

export interface ImageItem extends ItemBase {
  kind: "image";
  assetId: string;
  /** Accessibility description, stored separately from visible captions. */
  alt?: string;
  details?: ImageDetails;
  focal?: { x: number; y: number };
  crop?: { x: number; y: number; w: number; h: number };
  hotspots?: Hotspot[];
}

export interface TextItem extends ItemBase {
  kind: "text";
  text: string;
  style?: TextStyle;
}

/** An intact imported PDF page, or a designed composition. Both hold elements. */
export interface PageItem extends ItemBase {
  kind: "pdfPage" | "composition";
  /** Page render (pdfPage) or optional background image (composition). */
  assetId?: string;
  sourcePdfId?: string;
  pageNumber?: number;
  aspect: number;
  background?: string;
  elements: PageElement[];
  hotspots?: Hotspot[];
  label?: string;
}

export type Item = ImageItem | TextItem | PageItem;

export interface LayoutSettings {
  gap: number;
  columns: number;
  padding: number;
  maxWidth: number;
  captions: boolean;
}

export interface Theme {
  headingFont: string;
  bodyFont: string;
  text: string;
  background: string;
  accent: string;
  headingScale: number;
  bodyScale: number;
  letterSpacing: number;
  lineHeight: number;
}

export interface About {
  enabled: boolean;
  name?: string;
  discipline?: string;
  bio?: string;
  portraitId?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: { id: string; label: string; url: string }[];
  cvAssetId?: string;
  cvName?: string;
  show: {
    bio: boolean;
    portrait: boolean;
    contact: boolean;
    links: boolean;
    cv: boolean;
  };
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  /** null / undefined = inherit the portfolio default. */
  layout?: LayoutId | null;
  items: Item[];
}

export interface Snapshot {
  title: string;
  tagline?: string;
  projects: Project[];
  about: About;
  theme: Theme;
  defaultLayout: LayoutId;
  layoutSettings: Record<LayoutId, LayoutSettings>;
  singleProjectDirect: boolean;
}

export interface VersionSnapshot {
  id: string;
  name: string;
  at: number;
  snapshot: Snapshot;
}

export interface Portfolio extends Snapshot {
  id: string;
  slug: string;
  owner: string;
  discipline: Discipline;
  visibility: Visibility;
  searchEngineIndexing: boolean;
  isExample?: boolean;
  createdAt: number;
  updatedAt: number;
  published?: { at: number; snapshot: Snapshot };
  versions: VersionSnapshot[];
}

export interface TrashEntry {
  id: string;
  portfolioId: string;
  projectId?: string;
  label: string;
  at: number;
  kind: "item" | "project" | "element";
  payload: unknown;
  index?: number;
  parentItemId?: string;
}

export interface Doc {
  version: 3;
  portfolios: Portfolio[];
  assets: Record<string, AssetMeta>;
  trash: TrashEntry[];
  plan: "free" | "pro-concept";
  storageAllowanceMb: number;
}

export const FONT_CHOICES = [
  { id: '"Instrument Serif", serif', name: "Instrument Serif" },
  { id: '"Libre Baskerville", serif', name: "Libre Baskerville" },
  { id: '"Instrument Sans", sans-serif', name: "Instrument Sans" },
  { id: '"Space Grotesk", sans-serif', name: "Space Grotesk" },
  { id: '"DM Sans", sans-serif', name: "DM Sans" },
  { id: '"Archivo", sans-serif', name: "Archivo" },
  { id: '"JetBrains Mono", monospace', name: "JetBrains Mono" },
];

export const defaultTheme = (): Theme => ({
  headingFont: '"Instrument Serif", serif',
  bodyFont: '"Instrument Sans", sans-serif',
  text: "#1a1a1a",
  background: "#ffffff",
  accent: "#1a1a1a",
  headingScale: 1,
  bodyScale: 1,
  letterSpacing: 0,
  lineHeight: 1.6,
});

export const defaultLayoutSettings = (): Record<LayoutId, LayoutSettings> => ({
  paged: { gap: 24, columns: 1, padding: 48, maxWidth: 1000, captions: true },
  scroll: { gap: 96, columns: 1, padding: 32, maxWidth: 900, captions: true },
  grid: { gap: 12, columns: 3, padding: 24, maxWidth: 1200, captions: false },
  masonry: { gap: 16, columns: 3, padding: 24, maxWidth: 1200, captions: false },
  book: { gap: 0, columns: 1, padding: 32, maxWidth: 1000, captions: true },
});

export const defaultAbout = (): About => ({
  enabled: false,
  show: { bio: true, portrait: true, contact: true, links: true, cv: true },
  links: [],
});

export function hasDetails(d?: ImageDetails): boolean {
  if (!d) return false;
  return Boolean(
    d.title ||
      d.description ||
      d.date ||
      d.medium ||
      d.dimensions ||
      d.credits ||
      d.custom?.some((c) => c.label && c.value) ||
      d.links?.some((l) => l.url),
  );
}

export function itemLabel(item: Item): string {
  switch (item.kind) {
    case "text":
      return item.text.slice(0, 40) || "Text";
    case "image":
      return item.details?.title || "Image";
    case "pdfPage":
      return item.label || `PDF page ${item.pageNumber ?? ""}`.trim();
    case "composition":
      return item.label || "Composition";
  }
}
