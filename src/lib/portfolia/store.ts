import { useSyncExternalStore } from "react";
import { deleteBlob, uid } from "./assets";

/**
 * Local prototype store. Settings live in localStorage; PDFs and photos live
 * in IndexedDB (see assets.ts). Nothing here is sent to a server.
 */

export const UPLOAD_LIMIT_MB = 25;
export const UPLOAD_LIMIT = UPLOAD_LIMIT_MB * 1024 * 1024;
export const GRACE_DAYS = 30;
export const PRICE = { month: "£3", year: "£25" };

export interface PdfFile {
  blobKey: string;
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
}

export interface Portfolio {
  code: string; // free address: /p/<code>
  status: "draft" | "published";
  profile: Profile;
  pdf: PdfFile | null;
  allowDownload: boolean;
  plan: "free" | "personal";
  billing?: "month" | "year";
  username?: string;
  cancelledAt?: number;
  createdAt: number;
  publishedAt?: number;
}

export interface Analytics {
  visits: { t: number; v: string }[];
  downloads: number[];
}

interface Doc {
  v: 1;
  account: { signedIn: boolean };
  portfolio: Portfolio | null;
  analytics: Analytics;
}

const KEY = "portfolia.simple.v1";
const empty = (): Doc => ({ v: 1, account: { signedIn: false }, portfolio: null, analytics: { visits: [], downloads: [] } });

let state: Doc = empty();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...empty(), ...JSON.parse(raw) };
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
  listeners.forEach((l) => l());
  return true;
}

export function getDoc(): Doc {
  load();
  return state;
}

export function update(fn: (d: Doc) => Doc): boolean {
  load();
  return commit(fn(structuredClone(state)));
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

export function startPortfolio(pdf: PdfFile): boolean {
  return update((d) => {
    if (d.portfolio) {
      // Only one active portfolio: a new upload on the landing page becomes the draft's PDF.
      if (d.portfolio.status === "draft") d.portfolio.pdf = pdf;
      return d;
    }
    d.portfolio = {
      code: randomCode(),
      status: "draft",
      profile: { name: "", title: "", intro: "", email: "", links: [] },
      pdf,
      allowDownload: true,
      plan: "free",
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

export function patchProfile(patch: Partial<Profile>): boolean {
  return update((d) => {
    if (d.portfolio) d.portfolio.profile = { ...d.portfolio.profile, ...patch };
    return d;
  });
}

export async function replacePdf(pdf: PdfFile): Promise<boolean> {
  const old = getDoc().portfolio?.pdf;
  const ok = patchPortfolio({ pdf });
  if (ok && old && old.blobKey !== pdf.blobKey) await deleteBlob(old.blobKey).catch(() => {});
  return ok;
}

export async function deletePortfolio(): Promise<void> {
  const p = getDoc().portfolio;
  if (p?.pdf) await deleteBlob(p.pdf.blobKey).catch(() => {});
  if (p?.profile.photoKey) await deleteBlob(p.profile.photoKey).catch(() => {});
  update((d) => ({ ...d, portfolio: null, analytics: { visits: [], downloads: [] } }));
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = empty();
  listeners.forEach((l) => l());
}

/* ---------- Addresses ---------- */

export const RESERVED = ["admin", "support", "www", "api", "app", "mail", "help", "blog", "login", "signin", "portfolia", "status", "billing", "p", "u"];
export const DEMO_TAKEN = ["marta", "studio", "anna", "design", "photo", "architect", "art", "john"];

export function checkUsername(raw: string): { ok: boolean; msg: string } {
  const u = raw.trim().toLowerCase();
  if (!u) return { ok: false, msg: "Enter a name for your address." };
  if (u.length < 3) return { ok: false, msg: "Use at least 3 characters." };
  if (u.length > 30) return { ok: false, msg: "Use 30 characters or fewer." };
  if (/[^a-z0-9-]/.test(u)) return { ok: false, msg: "Use only lowercase letters, numbers and hyphens — no spaces, dots or accents." };
  if (u.startsWith("-") || u.endsWith("-")) return { ok: false, msg: "The address can’t start or end with a hyphen." };
  if (u.includes("--")) return { ok: false, msg: "Avoid two hyphens in a row." };
  if (RESERVED.includes(u)) return { ok: false, msg: "This name is reserved by Portfolia." };
  if (DEMO_TAKEN.includes(u)) return { ok: false, msg: "Already taken (demo data). Try a variation." };
  return { ok: true, msg: "Available (demo check)." };
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

function visitorId() {
  let v = localStorage.getItem("portfolia.vid");
  if (!v) {
    v = uid("v");
    localStorage.setItem("portfolia.vid", v);
  }
  return v;
}

function isBot() {
  return navigator.webdriver || /bot|crawl|spider|slurp|headless/i.test(navigator.userAgent);
}

/** Records at most one visit per browser tab session per portfolio. */
export function recordVisit(code: string) {
  if (typeof window === "undefined" || isBot()) return;
  const k = `portfolia.session.${code}`;
  if (sessionStorage.getItem(k)) return;
  sessionStorage.setItem(k, "1");
  const v = visitorId();
  update((d) => {
    d.analytics.visits.push({ t: Date.now(), v });
    return d;
  });
}

export function recordDownload() {
  if (typeof window === "undefined" || isBot()) return;
  update((d) => {
    d.analytics.downloads.push(Date.now());
    return d;
  });
}
