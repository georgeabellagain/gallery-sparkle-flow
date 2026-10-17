import { validateFoldout } from "./foldouts";
import { validatePageTag, validatePageLink } from "./page-extras";
import type { ExtraKind, Extra } from "./scrapbook-transform";
import { backgroundKeys } from "./background-settings";
import { foldoutKeys } from "./foldouts";
import { useSyncExternalStore } from "react";
import { deleteBlob, setAssetRetention, uid } from "./assets";

/**
 * Portfolio store. A localStorage copy keeps the UI instant; once signed in,
 * every change is synced to the account by cloud.ts, and files go to storage.
 */

export const FREE_UPLOAD_LIMIT_MB = 10;
export const PERSONAL_UPLOAD_LIMIT_MB = 50;
export const GRACE_DAYS = 30;
export const PRICE = { month: "£3", year: "£25" };
export const MAX_PORTFOLIOS = 10;
export const CV_LIMIT_MB = 10;

export interface CvFile {
  blobKey: string;
  name: string;
  bytes: number;
}

export interface PageStyle {
  font: string;
  nameFontSize?: number;
  detailsFontSize?: number;
  text: string;
  background: string;
  backdrop: string;
  bannerKey?: string;
}

export interface ViewerSettings {
  mode: "scroll" | "paged" | "book";
  /** Creator-selected flipbook motion; omitted retains Classic at normal speed. */
  turnStyle?: import("./turn-motion").TurnStyle;
  turnSpeed?: number;
  turnCurve?: import("./turn-curve").TurnCurve;
  /** Reading modes offered to visitors. Older portfolios without this use all modes. */
  modes?: ("scroll" | "paged" | "book")[];
  look: "clean" | "studio";
  /** Flipbook appearances offered to visitors. Older portfolios use their saved look only. */
  looks?: ("clean" | "studio")[];
  /** Reading modes allowed to offer Studio. Omitted retains all modes for older portfolios. */
  studioModes?: ("scroll" | "paged" | "book")[];
  /** Creator-defined Studio lighting. */
  /** Studio exposure control, 0..2 (200%). */
  studioBrightness?: number;
  /** Optional white overhead fill, 0..1; omitted is off. */
  studioTopLight?: number;
  studioImperfections?: boolean | number;
  studioPlayback?: "live" | "rendered";
  /** Retention of HDRI detail versus its solid average colour, 0..1. */
  studioLightingStrength?: number;
  /** Illuminate uploaded backgrounds with the same Studio scene. */
  backgroundLighting?: boolean;
  /** Opt-in surface normal/roughness lighting for Studio backgrounds. */
  background3D?: boolean;
  studioLighting?: import("./lighting").HdriId;
  /** Simple look: the soft shadow under the book. On unless switched off. */
  simpleShadow?: boolean;
  /** How dark that shadow is, 0 to 1. Starts at 0.2. */
  simpleShadowOpacity?: number;
  background: "midnight" | "black" | "paper" | "soft" | "oak" | "walnut";
  finish: import("./surface").SurfaceKind;
  paper: "smooth" | "natural";
  light: "soft" | "bright";
  shadow: "none" | "subtle" | "grounded";
  thickness: "thin" | "medium" | "thick";
  spreads: "single" | "ready";
  /** Shows the profile as a small icon in the viewer. */
  showHeader: boolean;
  /** Colour chosen on the colour wheel for behind the PDF. Takes priority over `background`. */
  backgroundColor?: string;
  /** Uploaded picture behind the PDF (a stored file key). Shown instead of the colour. */
  backgroundKey?: string;
  /** Uploaded pictures available to every visual style. */
  backgroundUploads?: string[];
  /** Bundled CC0 background; uploaded pictures take precedence. */
  backgroundPreset?: string;
  /** Size and position of the background picture. */
  backgroundFit?: { scale: number; x: number; y: number; tile?: boolean };
  /** Optional per-look / per-reading-style backgrounds; omitted entries use the shared background. */
  backgrounds?: Partial<Record<BackgroundContext, { backgroundColor?: string; backgroundPreset?: string; backgroundKey?: string; backgroundFit?: import("./background").BackgroundFit }>>;
}

export type BackgroundContext = "studio" | "clean" | "scroll" | "paged";

export const DEFAULT_VIEWER: ViewerSettings = {
  mode: "scroll",
  look: "clean",
  background: "midnight",
  finish: "matte",
  paper: "smooth",
  light: "soft",
  shadow: "subtle",
  thickness: "thin",
  spreads: "single",
  showHeader: true,
};

export const FONT_OPTIONS = [
  { label: "Instrument Serif", css: '"Instrument Serif", Georgia, serif' },
  { label: "Libre Baskerville", css: '"Libre Baskerville", Georgia, serif' },
  { label: "Instrument Sans", css: '"Instrument Sans", system-ui, sans-serif' },
  { label: "DM Sans", css: '"DM Sans", system-ui, sans-serif' },
  { label: "Space Grotesk", css: '"Space Grotesk", system-ui, sans-serif' },
  { label: "Archivo", css: '"Archivo", system-ui, sans-serif' },
];

export const DEFAULT_STYLE: PageStyle = { font: FONT_OPTIONS[0]!.css, text: "#1f1d1a", background: "#fbfaf6", backdrop: "#191d3a" };

export interface Domain {
  name: string;
  kind: "owned" | "purchased";
  addedAt: number;
}

export interface PdfFile {
  blobKey: string;
  /** Project navigation belongs to this exact PDF; replacing the file clears it. */
  projects?: import("./projects").PortfolioProject[];
  /** Optional interactive additions, bound to this exact PDF. */
  foldouts?: import("./foldouts").Foldout[];
  /** Coloured page tabs, visible on the closed book; they jump to their page. */
  tags?: import("./page-extras").PageTag[];
  /** Clickable website links placed on pages. */
  links?: import("./page-extras").PageLink[];
  /** Optional derived JPEG used in public link previews. */
  coverKey?: string;
  renderedStudio?: import("./rendered-studio").RenderedStudio;
  name: string;
  bytes: number;
  pages: number;
  uploadedAt: number;
}

export interface Profile {
  name: string;
  title: string;
  intro: string;
  photoKey?: string;
  email: string;
  links: { label: string; url: string }[];
  cv?: CvFile;
}

export interface Portfolio {
  name?: string;
  bookMarketing?: { description: string; buyUrl: string; label: string };
  code: string; // free address: /p/<code>
  status: "draft" | "published";
  profile: Profile;
  pdf: PdfFile | null;
  allowDownload: boolean;
  /** Opt-in: allow search engines to index this portfolio. Off by default. */
  searchIndexing?: boolean;
  plan: "free" | "personal";
  billing?: "month" | "year";
  username?: string;
  cancelledAt?: number;
  createdAt: number;
  publishedAt?: number;
  domains?: Domain[];
  style?: PageStyle;
  viewer?: ViewerSettings;
  /** Stored in the signed-in account. */
  synced?: boolean;
}

export interface Analytics {
  visits: { t: number; v: string }[];
  downloads: number[];
}

export interface Doc {
  v: 1;
  account: { signedIn: boolean };
  portfolio: Portfolio | null;
  analytics: Analytics;
  /** Inactive portfolios (paid plan). The active one lives in `portfolio`. */
  others: { portfolio: Portfolio; analytics: Analytics }[];
}

const KEY = "portfolia.simple.v1";
const empty = (): Doc => ({ v: 1, account: { signedIn: false }, portfolio: null, analytics: { visits: [], downloads: [] }, others: [] });

let state: Doc = empty();
let portfolioDraft: Portfolio | null = null;
let draftView: Doc | null = null;
const assetKeys = (p: Portfolio | null) => p ? [p.pdf?.blobKey, p.pdf?.coverKey, p.profile.photoKey, p.profile.cv?.blobKey, p.style?.bannerKey, ...backgroundKeys(p.viewer), ...foldoutKeys(p.pdf)].filter((key): key is string => Boolean(key)) : [];
const notify = () => { draftView = null; listeners.forEach(l => l()); };
export function getSavedDoc(): Doc { load(); return state; }
export function beginPortfolioDraft(code: string) {
  if (portfolioDraft?.code === code || state.portfolio?.code !== code) return;
  portfolioDraft = structuredClone(state.portfolio);
  setAssetRetention(key => allPortfolios(state).some(p => assetKeys(p).includes(key)));
  notify();
}
export function portfolioDraftDirty() { return Boolean(portfolioDraft && JSON.stringify(portfolioDraft) !== JSON.stringify(state.portfolio)); }
export function isPortfolioDraft(code: string) { return portfolioDraft?.code === code; }
export function savePortfolioDraft(): boolean {
  if (!portfolioDraft || state.portfolio?.code !== portfolioDraft.code) return false;
  const oldKeys = assetKeys(state.portfolio);
  const next = { ...state, portfolio: structuredClone(portfolioDraft) };
  if (!commit(next)) return false;
  oldKeys.filter(key => !assetKeys(portfolioDraft).includes(key)).forEach(key => void deleteBlob(key).catch(() => {}));
  return true;
}
export function discardPortfolioDraft() {
  const staged = assetKeys(portfolioDraft), saved = assetKeys(state.portfolio);
  portfolioDraft = null; setAssetRetention(null); notify();
  staged.filter(key => !saved.includes(key)).forEach(key => void deleteUnusedPortfolioAsset(key).catch(() => {}));
}
let commitHook: ((d: Doc) => void) | null = null;
/** Called after every successful save (used to sync to the cloud). */
export function setCommitHook(fn: ((d: Doc) => void) | null) {
  commitHook = fn;
}
/** Replace state without triggering the commit hook (used when loading from the cloud). */
export function replaceDoc(next: Doc) {
  load();
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* cache only */ }
  state = next;
  if (portfolioDraft && next.portfolio?.code !== portfolioDraft.code) { portfolioDraft = null; setAssetRetention(null); }
  if (portfolioDraft && next.portfolio) {
    portfolioDraft = { ...portfolioDraft, plan: next.portfolio.plan, billing: next.portfolio.billing, cancelledAt: next.portfolio.cancelledAt, synced: next.portfolio.synced };
  }
  notify();
}
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const cached = JSON.parse(raw) as Partial<Doc>;
      state = { ...empty(), ...cached, account: { signedIn: false } };
    }
  } catch {
    /* corrupt data: start fresh */
  }
}

/** Returns false (and leaves state untouched) if the browser refused to save. */
function commit(next: Doc): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  state = next;
  if (portfolioDraft && next.portfolio?.code !== portfolioDraft.code) { portfolioDraft = null; setAssetRetention(null); }
  if (portfolioDraft && next.portfolio) {
    portfolioDraft = { ...portfolioDraft, plan: next.portfolio.plan, billing: next.portfolio.billing, cancelledAt: next.portfolio.cancelledAt, synced: next.portfolio.synced };
  }
  notify();
  commitHook?.(next);
  return true;
}

export function getDoc(): Doc {
  load();
  if (!portfolioDraft) return state;
  return draftView ??= { ...state, portfolio: portfolioDraft };
}

export function update(fn: (d: Doc) => Doc): boolean {
  load();
  const next = fn(structuredClone(getDoc()));
  if (portfolioDraft && next.portfolio?.code === portfolioDraft.code) {
    portfolioDraft = next.portfolio;
    const saved = state.portfolio!;
    next.portfolio = { ...saved, plan: portfolioDraft.plan, billing: portfolioDraft.billing, cancelledAt: portfolioDraft.cancelledAt };
    if (JSON.stringify(next) === JSON.stringify(state)) { notify(); return true; }
  } else if (portfolioDraft) {
    // Switching books must park the saved version, never the preview overlay.
    next.others = next.others.map(item => item.portfolio.code === state.portfolio?.code ? { ...item, portfolio: state.portfolio! } : item);
    portfolioDraft = null; setAssetRetention(null);
  }
  return commit(next);
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverDoc = empty();
export function useDoc(): Doc {
  return useSyncExternalStore(subscribe, getDoc, () => serverDoc);
}

function randomCode() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 5 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

export function startPortfolio(pdf: PdfFile, options: { newPortfolio?: boolean } = {}): boolean {
  if (options.newPortfolio && allPortfolios(getDoc()).length > 0 && !canAddPortfolio(getDoc())) return false;
  return update((d) => {
    if (options.newPortfolio && d.portfolio) {
      d.others.unshift({ portfolio: d.portfolio, analytics: d.analytics });
      d.portfolio = null;
      d.analytics = { visits: [], downloads: [] };
    }
    if (d.portfolio) {
      // Only one active portfolio: a new upload on the landing page becomes the draft's PDF.
      if (d.portfolio.status === "draft") d.portfolio.pdf = pdf;
      return d;
    }
    const paid = isPaid(d);
    // Additional portfolios reuse the creator's existing profile rather than starting blank.
    const prior = allPortfolios(d).find((x) => x.profile?.name?.trim());
    d.portfolio = {
      code: randomCode(),
      status: "draft",
      profile: prior ? structuredClone(prior.profile) : { name: "", title: "", intro: "", email: "", links: [] },
      pdf,
      allowDownload: true,
      viewer: { ...DEFAULT_VIEWER, mode: "book" },
      plan: paid ? "personal" : "free",
      billing: paid ? allPortfolios(d).find((x) => x.plan === "personal")?.billing : undefined,
      createdAt: Date.now(),
    };
    return d;
  });
}

export function patchPortfolio(patch: Partial<Portfolio>): boolean {
  return update((d) => {
    if (d.portfolio) d.portfolio = { ...d.portfolio, ...patch };
    return d;
  });
}

/** Live pointer edits are scoped to the original portfolio and PDF. */
export function patchPortfolioExtra(code:string,blobKey:string,kind:ExtraKind,id:string,next:Extra):boolean {
  const portfolio=allPortfolios(getDoc()).find(p=>p.code===code);
  if(next.id!==id || !portfolio?.pdf || portfolio.pdf.blobKey!==blobKey || !portfolio.pdf[kind]?.some(item=>item.id===id))return false;
  const error=kind==='foldouts'?validateFoldout(next as import('./foldouts').Foldout,portfolio.pdf.pages):kind==='tags'?validatePageTag(next as import('./page-extras').PageTag,portfolio.pdf.pages):validatePageLink(next as import('./page-extras').PageLink,portfolio.pdf.pages);
  if(error)return false;
  return update(d=>{
    const p=allPortfolios(d).find(p=>p.code===code)!;
    p.pdf={...p.pdf!,[kind]:p.pdf![kind]!.map(item=>item.id===id?next:item)};
    return d;
  });
}

/** Appearance saves belong to their editor, even if an upload finishes after switching portfolios. */
export function patchPortfolioAppearance(code: string, patch: { viewer?: Partial<ViewerSettings>; style?: Partial<PageStyle> }): boolean {
  if (!allPortfolios(getDoc()).some(p => p.code === code)) return false;
  return update(d => {
    const p = allPortfolios(d).find(item => item.code === code)!;
    if (patch.viewer) p.viewer = { ...DEFAULT_VIEWER, ...p.viewer, ...patch.viewer };
    if (patch.style) p.style = { ...DEFAULT_STYLE, ...p.style, ...patch.style };
    return d;
  });
}

/** Older portfolios can share an asset key; changing one must not erase another's picture. */
export function portfolioUsesAsset(key: string): boolean {
  return [...allPortfolios(getDoc()), ...allPortfolios(getSavedDoc())].some(p => [p.pdf?.blobKey, p.pdf?.coverKey, p.profile.photoKey, p.profile.cv?.blobKey,
    p.style?.bannerKey, ...backgroundKeys(p.viewer), ...foldoutKeys(p.pdf)].includes(key));
}
export async function deleteUnusedPortfolioAsset(key?: string) {
  if (key && !portfolioUsesAsset(key)) await deleteBlob(key);
}

export function patchProfile(patch: Partial<Profile>): boolean {
  return update((d) => {
    if (d.portfolio) d.portfolio.profile = { ...d.portfolio.profile, ...patch };
    return d;
  });
}

export async function replacePdf(pdf: PdfFile): Promise<boolean> {
  const old = getDoc().portfolio?.pdf;
  const ok = patchPortfolio({ pdf });
  if (ok && old && old.blobKey !== pdf.blobKey) {
    await Promise.all(foldoutKeys(old).map(key => deleteBlob(key).catch(() => {})));
    await deleteBlob(old.blobKey).catch(() => {});
    if (old.coverKey) await deleteBlob(old.coverKey).catch(() => {});
  }
  return ok;
}

export async function deletePortfolio(): Promise<void> {
  const p = getDoc().portfolio;
  await Promise.all(foldoutKeys(p?.pdf).map(key => deleteBlob(key).catch(() => {})));
  if (p?.pdf) await deleteBlob(p.pdf.blobKey).catch(() => {});
  if (p?.pdf?.coverKey) await deleteBlob(p.pdf.coverKey).catch(() => {});
  if (p?.profile.photoKey) await deleteBlob(p.profile.photoKey).catch(() => {});
  if (p?.profile.cv) await deleteBlob(p.profile.cv.blobKey).catch(() => {});
  update((d) => {
    const [next, ...rest] = d.others;
    return next ? { ...d, portfolio: next.portfolio, analytics: next.analytics, others: rest } : { ...d, portfolio: null, analytics: { visits: [], downloads: [] } };
  });
}

/* ---------- Multiple portfolios (paid) ---------- */

export function allPortfolios(d: Doc): Portfolio[] {
  return [...(d.portfolio ? [d.portfolio] : []), ...d.others.map((o) => o.portfolio)];
}

export function isPaid(d: Doc): boolean {
  return allPortfolios(d).some((p) => p.plan === "personal");
}

export function uploadLimitMb(d: Doc): number {
  return isPaid(d) ? PERSONAL_UPLOAD_LIMIT_MB : FREE_UPLOAD_LIMIT_MB;
}

export function canAddPortfolio(d: Doc): boolean {
  return isPaid(d) && allPortfolios(d).length < MAX_PORTFOLIOS;
}

/** Parks the active portfolio so a new upload starts a fresh one. */
export function beginNewPortfolio(): boolean {
  return update((d) => {
    if (!canAddPortfolio(d) || !d.portfolio) return d;
    d.others.unshift({ portfolio: d.portfolio, analytics: d.analytics });
    d.portfolio = null;
    d.analytics = { visits: [], downloads: [] };
    return d;
  });
}

export function switchPortfolio(code: string): boolean {
  return update((d) => {
    const i = d.others.findIndex((o) => o.portfolio.code === code);
    if (i < 0) return d;
    const [target] = d.others.splice(i, 1);
    if (d.portfolio) d.others.unshift({ portfolio: d.portfolio, analytics: d.analytics });
    d.portfolio = target!.portfolio;
    d.analytics = target!.analytics;
    return d;
  });
}

/** Applies a plan change to every portfolio. Cancelling never deletes anything. */
export function setPlanAll(patch: Pick<Portfolio, "plan"> & Partial<Portfolio>): boolean {
  return update((d) => {
    if (d.portfolio) d.portfolio = { ...d.portfolio, ...patch };
    d.others = d.others.map((o) => ({ ...o, portfolio: { ...o.portfolio, ...patch } }));
    return d;
  });
}

export function findPortfolio(d: Doc, test: (p: Portfolio) => boolean): Portfolio | undefined {
  return allPortfolios(d).find(test);
}

/* ---------- Domains (demo, paid) ---------- */

export function checkDomain(raw: string): { ok: boolean; msg: string; name: string } {
  const name = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!name) return { ok: false, msg: "Enter a domain, like yourname.com.", name };
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(name)) return { ok: false, msg: "That doesn’t look like a domain. Try yourname.com.", name };
  if (name.endsWith("portfolia.com") || name.endsWith("portfolia.site")) return { ok: false, msg: "Use the personalised address for Portfolia names.", name };
  return { ok: true, msg: "", name };
}

export const DOMAIN_PRICES: Record<string, string> = { com: "£12 / year", co: "£24 / year", "co.uk": "£8 / year", studio: "£22 / year", art: "£15 / year", design: "£38 / year", net: "£13 / year", site: "£29 / year" };

export function domainPrice(name: string): string | null {
  const tld = Object.keys(DOMAIN_PRICES).sort((a, b) => b.length - a.length).find((t) => name.endsWith(`.${t}`));
  return tld ? DOMAIN_PRICES[tld]! : null;
}

export function addDomain(domain: Domain): boolean {
  return update((d) => {
    if (d.portfolio) d.portfolio.domains = [...(d.portfolio.domains ?? []).filter((x) => x.name !== domain.name), domain];
    return d;
  });
}

export function removeDomain(name: string): boolean {
  return update((d) => {
    if (d.portfolio) d.portfolio.domains = (d.portfolio.domains ?? []).filter((x) => x.name !== name);
    return d;
  });
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = empty();
  listeners.forEach((l) => l());
}

/* ---------- Addresses ---------- */

export const RESERVED = ["hdri-book-visualisation", "scrapbook-preview", "zine-flipbook", "magazine-flipbook", "admin", "support", "www", "api", "app", "mail", "help", "blog", "login", "signin", "portfolia", "status", "billing", "dashboard", "create", "p", "u", "reset-password", "signup", "account", "pricing", "terms", "privacy", "refund", "portfolio-checker", "embed-flipbook-in-squarespace", "embed-flipbook-in-wix", "embed-flipbook-in-notion", "sitemap.xml", "robots.txt", "sample", "free-pdf-portfolio", "free-portfolio-website", "architecture-portfolio", "fashion-portfolio"];

export function checkUsername(raw: string): { ok: boolean; msg: string } {
  const u = raw.trim().toLowerCase();
  if (!u) return { ok: false, msg: "Enter a name for your address." };
  if (u.length < 3) return { ok: false, msg: "Use at least 3 characters." };
  if (u.length > 30) return { ok: false, msg: "Use 30 characters or fewer." };
  if (/[^a-z0-9-]/.test(u)) return { ok: false, msg: "Use only lowercase letters, numbers and hyphens — no spaces, dots or accents." };
  if (u.startsWith("-") || u.endsWith("-")) return { ok: false, msg: "The address can’t start or end with a hyphen." };
  if (u.includes("--")) return { ok: false, msg: "Avoid two hyphens in a row." };
  if (RESERVED.includes(u)) return { ok: false, msg: "This name is reserved by Portfolia." };
  return { ok: true, msg: "" };
}

export function personalActive(p: Portfolio): boolean {
  if (!p.username) return false;
  if (p.plan === "personal") return true;
  return Boolean(p.cancelledAt && Date.now() < p.cancelledAt + GRACE_DAYS * 864e5);
}

export function graceEnds(p: Portfolio): Date | null {
  return p.cancelledAt ? new Date(p.cancelledAt + GRACE_DAYS * 864e5) : null;
}

/* ---------- Analytics (sessions, not page renders) ---------- */

const visitorSession = createVisitorSession(() => uid("v"));
function visitorId() {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* blocked browser storage */ }
  return visitorSession.visitor(storage);
}

function isBot() {
  return navigator.webdriver || /bot|crawl|spider|slurp|headless/i.test(navigator.userAgent);
}

/** Records at most one visit per browser tab session per portfolio. */
export function recordVisit(code: string) {
  if (typeof window === "undefined" || isBot()) return;
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* blocked browser storage */ }
  if (!visitorSession.firstVisit(code, storage)) return;
  const v = visitorId();
  update((d) => {
    const a = d.portfolio?.code === code ? d.analytics : d.others.find((o) => o.portfolio.code === code)?.analytics;
    a?.visits.push({ t: Date.now(), v });
    return d;
  });
  void logEvent(code, "visit", v);
}

async function logEvent(code: string, kind: "visit" | "download", visitor?: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.from("portfolio_events").insert({ portfolio_code: code, kind, visitor }).then(() => {}, () => {});
}

export function recordDownload(code?: string) {
  if (typeof window === "undefined" || isBot()) return;
  update((d) => {
    const a = !code || d.portfolio?.code === code ? d.analytics : d.others.find((o) => o.portfolio.code === code)?.analytics;
    a?.downloads.push(Date.now());
    return d;
  });
  const c = code ?? getDoc().portfolio?.code;
  if (c) void logEvent(c, "download");
}
import { createVisitorSession } from "./visitor-storage";
