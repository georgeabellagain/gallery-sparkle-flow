/**
 * Prototype store: one document, kept in memory, mirrored to localStorage.
 * Asset bytes live in IndexedDB (see assets.ts). Nothing leaves this browser.
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  defaultAbout,
  defaultLayoutSettings,
  defaultTheme,
  type AssetMeta,
  type Doc,
  type Item,
  type LayoutId,
  type Portfolio,
  type Project,
  type Snapshot,
  type TrashEntry,
} from "./types";
import { uid } from "./assets";
import { buildSeedDoc } from "./seed";

const KEY = "portfolia.doc.v3";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Runtime {
  doc: Doc;
  save: SaveState;
  lastSavedAt: number | null;
  /** Prototype switch: makes the next save fail so retry can be demonstrated. */
  failNextSave: boolean;
  undo: string[];
  redo: string[];
}

let state: Runtime = {
  doc: buildSeedDoc(),
  save: "idle",
  lastSavedAt: null,
  failNextSave: false,
  undo: [],
  redo: [],
};

let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!hydrated) hydrate();
  return () => listeners.delete(cb);
}

function hydrate() {
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Doc;
      if (parsed && parsed.version === 3 && Array.isArray(parsed.portfolios)) {
        const seed = buildSeedDoc();
        // Demo portfolios and bundled assets always come from the build.
        const userPortfolios = parsed.portfolios.filter((p) => !p.isExample);
        state = {
          ...state,
          doc: {
            ...parsed,
            portfolios: [...seed.portfolios, ...userPortfolios],
            assets: { ...parsed.assets, ...seed.assets },
          },
        };
      }
    }
  } catch {
    /* corrupt or unavailable storage: fall back to the seed document */
  }
  emit();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persistSoon() {
  if (typeof window === "undefined") return;
  state = { ...state, save: "saving" };
  emit();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}

function flush() {
  if (typeof window === "undefined") return;
  try {
    if (state.failNextSave) throw new Error("Simulated save failure");
    const toSave: Doc = {
      ...state.doc,
      portfolios: state.doc.portfolios.filter((p) => !p.isExample),
    };
    window.localStorage.setItem(KEY, JSON.stringify(toSave));
    state = { ...state, save: "saved", lastSavedAt: Date.now() };
  } catch {
    state = { ...state, save: "error" };
  }
  emit();
}

export function retrySave() {
  state = { ...state, failNextSave: false };
  flush();
}

export function setFailNextSave(v: boolean) {
  state = { ...state, failNextSave: v, save: v ? state.save : state.save };
  emit();
}

/* ------------------------------------------------------------------ mutation */

interface MutateOptions {
  /** false for cursor-ish changes that should not create an undo step. */
  history?: boolean;
}

export function mutate(fn: (doc: Doc) => void, opts: MutateOptions = {}) {
  const { history = true } = opts;
  const before = history ? JSON.stringify(state.doc) : null;
  const next = structuredCloneSafe(state.doc);
  fn(next);
  state = {
    ...state,
    doc: next,
    undo: before ? [...state.undo, before].slice(-60) : state.undo,
    redo: before ? [] : state.redo,
  };
  persistSoon();
}

function structuredCloneSafe(doc: Doc): Doc {
  return typeof structuredClone === "function"
    ? structuredClone(doc)
    : (JSON.parse(JSON.stringify(doc)) as Doc);
}

export function undo() {
  const prev = state.undo[state.undo.length - 1];
  if (!prev) return;
  state = {
    ...state,
    doc: JSON.parse(prev) as Doc,
    undo: state.undo.slice(0, -1),
    redo: [...state.redo, JSON.stringify(state.doc)].slice(-60),
  };
  persistSoon();
}

export function redo() {
  const next = state.redo[state.redo.length - 1];
  if (!next) return;
  state = {
    ...state,
    doc: JSON.parse(next) as Doc,
    redo: state.redo.slice(0, -1),
    undo: [...state.undo, JSON.stringify(state.doc)].slice(-60),
  };
  persistSoon();
}

/* -------------------------------------------------------------------- hooks */

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return state;
}

export function useStore<T>(selector: (s: Runtime) => T): T {
  const sel = useCallback(() => selector(getSnapshot()), [selector]);
  return useSyncExternalStore(subscribe, sel, () => selector(getServerSnapshot()));
}

export function useDoc(): Doc {
  return useStore((s) => s.doc);
}

export function useSaveStatus() {
  return useStore((s) => ({
    save: s.save,
    lastSavedAt: s.lastSavedAt,
    failNextSave: s.failNextSave,
  }));
}

export function useHistoryFlags() {
  return useStore((s) => ({ canUndo: s.undo.length > 0, canRedo: s.redo.length > 0 }));
}

export function usePortfolio(id: string | undefined): Portfolio | undefined {
  return useStore((s) => s.doc.portfolios.find((p) => p.id === id));
}

export function usePortfolioBySlug(slug: string | undefined): Portfolio | undefined {
  return useStore((s) => s.doc.portfolios.find((p) => p.slug === slug));
}

export function useAssets(): Record<string, AssetMeta> {
  return useStore((s) => s.doc.assets);
}

/* ---------------------------------------------------------------- selectors */

export function storageUsed(doc: Doc): number {
  return Object.values(doc.assets)
    .filter((a) => !a.url)
    .reduce((n, a) => n + (a.bytes || 0), 0);
}

export function myPortfolios(doc: Doc): Portfolio[] {
  return doc.portfolios.filter((p) => !p.isExample);
}

export function layoutFor(p: Portfolio, project: Project | undefined): LayoutId {
  return (project?.layout ?? null) || p.defaultLayout;
}

export function snapshotOf(p: Portfolio): Snapshot {
  return {
    title: p.title,
    tagline: p.tagline,
    projects: p.projects,
    about: p.about,
    theme: p.theme,
    defaultLayout: p.defaultLayout,
    layoutSettings: p.layoutSettings,
    singleProjectDirect: p.singleProjectDirect,
  };
}

/* ------------------------------------------------------------------ actions */

export function registerAsset(meta: AssetMeta) {
  mutate((doc) => {
    doc.assets[meta.id] = meta;
  }, { history: false });
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "portfolio"
  );
}

export function uniqueSlug(doc: Doc, base: string): string {
  let slug = slugify(base);
  let i = 2;
  while (doc.portfolios.some((p) => p.slug === slug)) slug = `${slugify(base)}-${i++}`;
  return slug;
}

export function createPortfolio(opts: {
  title?: string;
  discipline?: Portfolio["discipline"];
  layout?: LayoutId;
  projectTitle?: string;
}): string {
  const id = uid("pf");
  const projectId = uid("pr");
  mutate((doc) => {
    const title = opts.title?.trim() || "Untitled portfolio";
    doc.portfolios.push({
      id,
      slug: uniqueSlug(doc, title),
      owner: "Demo creator",
      title,
      discipline: opts.discipline ?? "Other",
      visibility: "draft",
      searchEngineIndexing: false,
      defaultLayout: opts.layout ?? "scroll",
      layoutSettings: defaultLayoutSettings(),
      theme: defaultTheme(),
      about: defaultAbout(),
      singleProjectDirect: true,
      projects: [
        {
          id: projectId,
          title: opts.projectTitle?.trim() || "Untitled project",
          items: [],
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  return id;
}

export function updatePortfolio(
  id: string,
  fn: (p: Portfolio) => void,
  opts?: MutateOptions,
) {
  mutate((doc) => {
    const p = doc.portfolios.find((x) => x.id === id);
    if (!p) return;
    fn(p);
    p.updatedAt = Date.now();
  }, opts);
}

export function updateProject(
  portfolioId: string,
  projectId: string,
  fn: (pr: Project) => void,
  opts?: MutateOptions,
) {
  updatePortfolio(
    portfolioId,
    (p) => {
      const pr = p.projects.find((x) => x.id === projectId);
      if (pr) fn(pr);
    },
    opts,
  );
}

export function addProject(portfolioId: string, title = "Untitled project"): string {
  const id = uid("pr");
  updatePortfolio(portfolioId, (p) => {
    p.projects.push({ id, title, items: [] });
    if (p.projects.length > 1) p.singleProjectDirect = false;
  });
  return id;
}

export function addItems(portfolioId: string, projectId: string, items: Item[]) {
  updateProject(portfolioId, projectId, (pr) => {
    pr.items.push(...items);
  });
}

export function moveItem(
  portfolioId: string,
  projectId: string,
  from: number,
  to: number,
) {
  updateProject(portfolioId, projectId, (pr) => {
    if (to < 0 || to >= pr.items.length) return;
    const [it] = pr.items.splice(from, 1);
    if (it) pr.items.splice(to, 0, it);
  });
}

export function trashItem(portfolioId: string, projectId: string, itemId: string) {
  mutate((doc) => {
    const p = doc.portfolios.find((x) => x.id === portfolioId);
    const pr = p?.projects.find((x) => x.id === projectId);
    if (!p || !pr) return;
    const index = pr.items.findIndex((i) => i.id === itemId);
    if (index < 0) return;
    const [removed] = pr.items.splice(index, 1);
    doc.trash.unshift({
      id: uid("tr"),
      portfolioId,
      projectId,
      label: describeItem(removed!),
      at: Date.now(),
      kind: "item",
      payload: removed,
      index,
    });
  });
}

export function trashProject(portfolioId: string, projectId: string) {
  mutate((doc) => {
    const p = doc.portfolios.find((x) => x.id === portfolioId);
    if (!p) return;
    const index = p.projects.findIndex((x) => x.id === projectId);
    if (index < 0) return;
    const [removed] = p.projects.splice(index, 1);
    doc.trash.unshift({
      id: uid("tr"),
      portfolioId,
      label: `Project — ${removed!.title}`,
      at: Date.now(),
      kind: "project",
      payload: removed,
      index,
    });
  });
}

export function trashElement(
  portfolioId: string,
  projectId: string,
  itemId: string,
  elementId: string,
) {
  mutate((doc) => {
    const p = doc.portfolios.find((x) => x.id === portfolioId);
    const pr = p?.projects.find((x) => x.id === projectId);
    const item = pr?.items.find((i) => i.id === itemId);
    if (!item || !("elements" in item)) return;
    const index = item.elements.findIndex((e) => e.id === elementId);
    if (index < 0) return;
    const [removed] = item.elements.splice(index, 1);
    doc.trash.unshift({
      id: uid("tr"),
      portfolioId,
      projectId,
      parentItemId: itemId,
      label: removed!.kind === "text" ? `Text — ${removed!.text?.slice(0, 24)}` : "Image element",
      at: Date.now(),
      kind: "element",
      payload: removed,
      index,
    });
  });
}

export function restoreTrash(entryId: string) {
  mutate((doc) => {
    const idx = doc.trash.findIndex((t) => t.id === entryId);
    if (idx < 0) return;
    const entry = doc.trash[idx]!;
    const p = doc.portfolios.find((x) => x.id === entry.portfolioId);
    if (!p) return;
    if (entry.kind === "project") {
      p.projects.splice(Math.min(entry.index ?? p.projects.length, p.projects.length), 0, entry.payload as Project);
    } else {
      const pr = p.projects.find((x) => x.id === entry.projectId);
      if (!pr) return;
      if (entry.kind === "item") {
        pr.items.splice(Math.min(entry.index ?? pr.items.length, pr.items.length), 0, entry.payload as Item);
      } else {
        const item = pr.items.find((i) => i.id === entry.parentItemId);
        if (item && "elements" in item) {
          item.elements.splice(
            Math.min(entry.index ?? item.elements.length, item.elements.length),
            0,
            entry.payload as never,
          );
        }
      }
    }
    doc.trash.splice(idx, 1);
  });
}

export function purgeTrash(entryId?: string) {
  mutate((doc) => {
    doc.trash = entryId ? doc.trash.filter((t) => t.id !== entryId) : [];
  });
}

export function trashFor(doc: Doc, portfolioId: string): TrashEntry[] {
  return doc.trash.filter((t) => t.portfolioId === portfolioId);
}

function describeItem(i: Item): string {
  if (i.kind === "text") return `Text — ${i.text.slice(0, 24)}`;
  if (i.kind === "image") return i.details?.title ? `Image — ${i.details.title}` : "Image";
  if (i.kind === "pdfPage") return `PDF page ${i.pageNumber ?? ""}`.trim();
  return "Composition";
}

export function saveVersion(portfolioId: string, name: string) {
  updatePortfolio(portfolioId, (p) => {
    p.versions.unshift({
      id: uid("v"),
      name: name.trim() || new Date().toLocaleString(),
      at: Date.now(),
      snapshot: JSON.parse(JSON.stringify(snapshotOf(p))) as Snapshot,
    });
    p.versions = p.versions.slice(0, 20);
  });
}

export function restoreVersion(portfolioId: string, versionId: string) {
  updatePortfolio(portfolioId, (p) => {
    const v = p.versions.find((x) => x.id === versionId);
    if (!v) return;
    // Keep a snapshot of the pre-restore state so restoring is reversible.
    p.versions.unshift({
      id: uid("v"),
      name: `Before restoring “${v.name}”`,
      at: Date.now(),
      snapshot: JSON.parse(JSON.stringify(snapshotOf(p))) as Snapshot,
    });
    Object.assign(p, JSON.parse(JSON.stringify(v.snapshot)) as Snapshot);
  });
}

export function publish(portfolioId: string, visibility: "unlisted" | "discoverable" = "unlisted") {
  updatePortfolio(portfolioId, (p) => {
    p.published = {
      at: Date.now(),
      snapshot: JSON.parse(JSON.stringify(snapshotOf(p))) as Snapshot,
    };
    p.visibility = visibility;
  });
}

export function unpublish(portfolioId: string) {
  updatePortfolio(portfolioId, (p) => {
    p.visibility = "draft";
  });
}

export function hasUnpublishedChanges(p: Portfolio): boolean {
  if (!p.published) return true;
  return JSON.stringify(snapshotOf(p)) !== JSON.stringify(p.published.snapshot);
}

export function resetPrototypeData() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  state = { ...state, doc: buildSeedDoc(), undo: [], redo: [], save: "idle" };
  emit();
}
