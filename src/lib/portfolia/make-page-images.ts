import { useEffect, useSyncExternalStore } from "react";
import { cloudUserId, deleteBlobs, getBlob, getLocalBlob, uploadToCloud } from "./assets";
import { pageImageKey, pageImageKeys, pageTextKey, readablePageImages, PAGE_IMAGE_SIZES, type PageImageFormat, type PageImages, type PageImagePage } from "./page-images";
import type { RenderedPageImages } from "./page-image-render";
import { allPortfolios, attachPageImages, getSavedDoc, pdfOverLimit, portfolioUsesAsset, useDoc } from "./store";

/**
 * Makes a published portfolio's page pictures on the owner's device: after publishing, after replacing the PDF,
 * and for portfolios published before pictures existed (the dashboard backfill). One portfolio at a time.
 */

/** `waiting`: the pictures are missing and this browser would need to download the PDF to make them. */
export type PageImageProgress = { done: number; total: number; error?: string; waiting?: boolean };
const progress = new Map<string, PageImageProgress>();
const listeners = new Set<() => void>();
const setProgress = (code: string, value: PageImageProgress | null) => {
  if (value) progress.set(code, value); else progress.delete(code);
  listeners.forEach((l) => l());
};
export function usePageImageProgress(code: string): PageImageProgress | undefined {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => progress.get(code), () => undefined);
}

const pending = new Map<string, Promise<void>>();
/** Runs after any earlier portfolio's pictures, so two books never draw at once. */
let queue: Promise<unknown> = Promise.resolve();
/** Pictures that failed this session are retried only when asked. */
const failed = new Set<string>();

const savedPortfolio = (code: string, pdfKey: string) =>
  allPortfolios(getSavedDoc()).find((p) => p.code === code && p.pdf?.blobKey === pdfKey && p.status === "published");
const ownsCurrent = (code: string, pdfKey: string) => getSavedDoc().account.signedIn && Boolean(savedPortfolio(code, pdfKey));

/** Draws pages in a worker, or here where a worker can't run pdf.js (no OffscreenCanvas or worker fonts). */
export async function* drawPages(pdf: Blob): AsyncGenerator<{ format: PageImageFormat; pages: number } | RenderedPageImages, void, void> {
  const buffer = await pdf.arrayBuffer();
  const viaWorker = await (async function* () {
    if (typeof Worker === "undefined") return false;
    const worker = new Worker(new URL("./page-images.worker.ts", import.meta.url), { type: "module" });
    const inbox: MessageEvent["data"][] = [];
    let notify: (() => void) | null = null;
    worker.onmessage = (event) => { inbox.push(event.data); notify?.(); notify = null; };
    worker.onerror = () => { inbox.push({ type: "error", message: "unsupported" }); notify?.(); notify = null; };
    worker.postMessage({ type: "start", buffer, credit: 3 }, [buffer]);
    let started = false;
    try {
      for (;;) {
        while (!inbox.length) await new Promise<void>((resolve) => { notify = resolve; });
        const message = inbox.shift();
        if (message.type === "error") {
          if (!started && message.message === "unsupported") return false;
          throw new Error(message.message === "unsupported" ? "This browser stopped drawing the pages. Please try again." : message.message);
        }
        if (message.type === "done") return true;
        if (message.type === "start") { started = true; yield { format: message.format, pages: message.pages }; }
        if (message.type === "page") { yield message.result as RenderedPageImages; worker.postMessage({ type: "credit" }); }
      }
    } finally {
      worker.terminate();
    }
  })();
  // The worker's buffer was transferred, so the fallback reads the file again.
  let result = await viaWorker.next();
  while (!result.done) { yield result.value; result = await viaWorker.next(); }
  if (result.value) return;
  const [{ loadPdfjs }, render] = await Promise.all([import("./pdf"), import("./page-image-render")]);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
  try {
    const format = await render.chooseFormat();
    yield { format, pages: doc.numPages };
    for (let n = 1; n <= doc.numPages; n++) {
      yield await render.renderPageImages(doc, n, format);
      // Leave the editor a moment to respond between pages.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await doc.destroy();
  }
}

async function upload(key: string, blob: Blob, owner: string | null) {
  for (let attempt = 0; ; attempt++) {
    try { return await uploadToCloud(key, blob, owner, "31536000"); }
    catch (error) { if (attempt >= 2) throw error; await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1))); }
  }
}

async function make(code: string, pdfKey: string, owner: string | null) {
  if (!ownsCurrent(code, pdfKey)) return;
  const blob = await getBlob(pdfKey);
  if (!blob) throw new Error("Couldn’t load the PDF to prepare its pages.");
  const uploaded: string[] = [];
  const pages: PageImagePage[] = [];
  let format: PageImageFormat = "webp";
  let total = 0;
  let completed = 0;
  const uploads = new Set<Promise<void>>();
  try {
    for await (const item of drawPages(blob)) {
      if (!ownsCurrent(code, pdfKey)) throw new Error("The portfolio changed.");
      if (!("page" in item)) { format = item.format; total = item.pages; setProgress(code, { done: 0, total }); continue; }
      const page = item;
      pages[page.page - 1] = { w: page.w, h: page.h, px: page.images.map((i) => [i.width, i.height]), ...(page.links.length ? { links: page.links } : {}), ...(page.text ? { text: true as const } : {}) };
      const work = (async () => {
        for (const image of page.images) {
          const key = pageImageKey(pdfKey, page.page, image.size, format);
          await upload(key, image.blob, owner);
          uploaded.push(key);
        }
        if (page.text) {
          const key = pageTextKey(pdfKey, page.page);
          await upload(key, page.text, owner);
          uploaded.push(key);
        }
        setProgress(code, { done: ++completed, total });
      })();
      uploads.add(work);
      void work.finally(() => uploads.delete(work)).catch(() => {});
      // At most three pages upload at once; the worker waits for the same credits.
      if (uploads.size >= 3) await Promise.race(uploads);
    }
    await Promise.all(uploads);
    if (pages.length !== total || pages.some((p) => !p)) throw new Error("Some pages couldn’t be prepared.");
    const manifest: PageImages = { v: 1, pdfKey, format, sizes: [...PAGE_IMAGE_SIZES], pages, text: true, createdAt: Date.now() };
    const before = savedPortfolio(code, pdfKey)?.pdf?.pageImages;
    if (!readablePageImages({ blobKey: pdfKey, pages: total, pageImages: manifest })) throw new Error("The page pictures couldn’t be checked.");
    if (!ownsCurrent(code, pdfKey) || savedPortfolio(code, pdfKey)?.pdf?.pages !== total || !attachPageImages(code, pdfKey, manifest)) throw new Error("The portfolio changed.");
    // Pictures of an earlier PDF that rode along with a copied file entry are no longer referenced.
    const stale = pageImageKeys({ pageImages: before }).filter((key) => !portfolioUsesAsset(key));
    if (stale.length) void deleteBlobs(stale).catch(() => {});
  } catch (error) {
    await Promise.allSettled(uploads);
    if (uploaded.length) void deleteBlobs(uploaded.filter((key) => !portfolioUsesAsset(key))).catch(() => {});
    throw error;
  }
}

/** Makes (or remakes) one portfolio's page pictures. Concurrent calls for the same PDF share one run. */
export function ensurePageImages(code: string, pdfKey: string): Promise<void> {
  const id = `${code}:${pdfKey}`;
  const running = pending.get(id);
  if (running) return running;
  failed.delete(id);
  setProgress(code, { done: 0, total: 0 });
  const owner = cloudUserId();
  const work = queue.then(() => make(code, pdfKey, owner)).then(
    () => setProgress(code, null),
    (error) => {
      failed.add(id);
      const changed = error instanceof Error && error.message === "The portfolio changed.";
      setProgress(code, changed ? null : { done: 0, total: 0, error: error instanceof Error ? error.message : "Couldn’t prepare the pages." });
      if (!changed) throw error;
    },
  ).finally(() => pending.delete(id));
  queue = work.catch(() => {});
  pending.set(id, work);
  return work;
}

/** Published portfolios of this account whose pictures are missing or belong to an older PDF. */
export function portfoliosNeedingPageImages() {
  const doc = getSavedDoc();
  if (!doc.account.signedIn) return [];
  return allPortfolios(doc).filter((p) => p.status === "published" && p.synced && p.pdf && p.pdf.pages > 0 && !pdfOverLimit(doc, p.pdf) && !readablePageImages(p.pdf));
}

/**
 * Starts any missing page pictures on the owner's device (dashboard and editor). Where this browser holds the
 * PDF (it was uploaded or replaced here) they start by themselves; elsewhere the PDF would have to be downloaded
 * first, possibly on a phone's data, so the portfolio card offers a button instead (PageImagesNote).
 */
export function usePageImageBackfill() {
  const doc = useDoc();
  useEffect(() => {
    if (!cloudUserId() || typeof window === "undefined") return;
    let live = true;
    for (const p of portfoliosNeedingPageImages()) {
      const key = p.pdf!.blobKey;
      if (failed.has(`${p.code}:${key}`) || pending.has(`${p.code}:${key}`)) continue;
      void getLocalBlob(key).then((local) => {
        if (!live || pending.has(`${p.code}:${key}`)) return;
        if (local) void ensurePageImages(p.code, key).catch(() => { /* shown by usePageImageProgress */ });
        else if (!progress.get(p.code)) setProgress(p.code, { done: 0, total: 0, waiting: true });
      });
    }
    return () => { live = false; };
  }, [doc]);
}
