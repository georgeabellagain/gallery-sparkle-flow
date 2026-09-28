import { putBlob, readImageSize, uid, cropBlob, getBlob } from "./assets";
import { getDoc, mutate } from "./store";
import type { Item } from "./types";

export interface UploadReport {
  added: number;
  failures: { name: string; reason: string }[];
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Store image uploads as assets and append them as items.
 * A failure on one file never discards the others or the rest of the work.
 */
export async function uploadImages(
  files: File[],
  opts: {
    portfolioId: string;
    projectId: string;
    onProgress?: (info: { done: number; total: number; name: string }) => void;
  },
): Promise<UploadReport> {
  const report: UploadReport = { added: 0, failures: [] };
  const items: Item[] = [];
  const metas: Parameters<typeof registerMany>[0] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    opts.onProgress?.({ done: i, total: files.length, name: file.name });
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Not an image file");
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error("Larger than the 20 MB prototype limit");
      }
      const size = await readImageSize(file);
      const blobKey = uid("blob");
      await putBlob(blobKey, file);
      const assetId = uid("as");
      metas.push({
        id: assetId,
        name: file.name,
        mime: file.type,
        bytes: file.size,
        width: size.width,
        height: size.height,
        blobKey,
        createdAt: Date.now(),
      });
      items.push({
        id: uid("it"),
        kind: "image",
        assetId,
        alt: "",
        details: {},
      });
      report.added++;
    } catch (e) {
      report.failures.push({
        name: file.name,
        reason: e instanceof Error ? e.message : "Could not be saved in this browser",
      });
    }
  }

  opts.onProgress?.({ done: files.length, total: files.length, name: "" });

  if (items.length) {
    registerMany(metas);
    mutate((doc) => {
      const p = doc.portfolios.find((x) => x.id === opts.portfolioId);
      const pr = p?.projects.find((x) => x.id === opts.projectId);
      if (!p || !pr) return;
      pr.items.push(...items);
      if (!pr.coverAssetId) {
        const first = items.find((i) => i.kind === "image");
        if (first && first.kind === "image") pr.coverAssetId = first.assetId;
      }
      p.updatedAt = Date.now();
    });
  }

  return report;
}

function registerMany(metas: {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  blobKey?: string;
  createdAt: number;
}[]) {
  mutate(
    (doc) => {
      for (const m of metas) doc.assets[m.id] = m;
    },
    { history: false },
  );
}

/** Store a single file as an asset (portrait, CV) and return its id. */
export async function uploadFileAsset(file: File): Promise<string> {
  const blobKey = uid("blob");
  await putBlob(blobKey, file);
  const assetId = uid("as");
  const size = file.type.startsWith("image/") ? await readImageSize(file) : undefined;
  mutate(
    (doc) => {
      doc.assets[assetId] = {
        id: assetId,
        name: file.name,
        mime: file.type,
        bytes: file.size,
        width: size?.width,
        height: size?.height,
        blobKey,
        createdAt: Date.now(),
      };
    },
    { history: false },
  );
  return assetId;
}

/**
 * Crop a rectangle out of an existing asset into a *new* image item.
 * The source asset is left untouched, and the new item is clearly a crop.
 */
export async function cropRegionToItem(
  sourceAssetId: string,
  rect: { x: number; y: number; w: number; h: number },
  opts: { portfolioId: string; projectId: string; label?: string },
): Promise<void> {
  const source = getDoc().assets[sourceAssetId];
  if (!source) throw new Error("The source image is not available in this browser.");
  let blob: Blob | undefined;
  if (source.blobKey) blob = await getBlob(source.blobKey);
  else if (source.url) blob = await fetch(source.url).then((r) => r.blob());
  if (!blob) throw new Error("The original image could not be read.");

  const cropped = await cropBlob(blob, rect);
  const blobKey = uid("blob");
  await putBlob(blobKey, cropped);
  const assetId = uid("as");

  mutate((doc) => {
    doc.assets[assetId] = {
      id: assetId,
      name: `${source.name} — cropped region`,
      mime: "image/jpeg",
      bytes: cropped.size,
      width: Math.round((source.width ?? 1200) * rect.w),
      height: Math.round((source.height ?? 900) * rect.h),
      blobKey,
      croppedFrom: sourceAssetId,
      createdAt: Date.now(),
    };
    const p = doc.portfolios.find((x) => x.id === opts.portfolioId);
    const pr = p?.projects.find((x) => x.id === opts.projectId);
    if (!p || !pr) return;
    pr.items.push({
      id: uid("it"),
      kind: "image",
      assetId,
      alt: "",
      details: { title: opts.label || "Cropped region" },
    });
    p.updatedAt = Date.now();
  });
}
