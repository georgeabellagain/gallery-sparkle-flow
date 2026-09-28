/**
 * Asset bytes live in IndexedDB. Originals are stored once and never mutated —
 * crops and page renders are written as *new* records.
 * This is browser-local storage: it only exists in this browser profile.
 */

const DB_NAME = "portfolia-assets";
const STORE = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Could not open storage"));
    });
  }
  return dbPromise;
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save file"));
    tx.onabort = () => reject(tx.error ?? new Error("Storage quota reached"));
  });
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/* -------------------------------------------------------------- object URLs */

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | undefined>>();

/** Resolve an asset id to a displayable URL (bundled url or IndexedDB blob). */
export function resolveAssetUrl(
  meta: { id: string; url?: string; blobKey?: string } | undefined,
): string | undefined | Promise<string | undefined> {
  if (!meta) return undefined;
  if (meta.url) return meta.url;
  if (!meta.blobKey) return undefined;
  const cached = urlCache.get(meta.blobKey);
  if (cached) return cached;
  const key = meta.blobKey;
  let p = pending.get(key);
  if (!p) {
    p = getBlob(key)
      .then((blob) => {
        if (!blob) return undefined;
        const url = URL.createObjectURL(blob);
        urlCache.set(key, url);
        return url;
      })
      .catch(() => undefined)
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

export function cachedAssetUrl(meta?: { url?: string; blobKey?: string }): string | undefined {
  if (!meta) return undefined;
  if (meta.url) return meta.url;
  if (meta.blobKey) return urlCache.get(meta.blobKey);
  return undefined;
}

/* ------------------------------------------------------------------ helpers */

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function formatBytes(n: number): string {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 1200, height: 900 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Crop a rectangle (normalised 0-1) out of a blob into a new JPEG blob. */
export async function cropBlob(
  blob: Blob,
  rect: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read the image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * rect.w));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * rect.h));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the crop");
    ctx.drawImage(
      img,
      img.naturalWidth * rect.x,
      img.naturalHeight * rect.y,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not create the crop"))),
        "image/jpeg",
        0.92,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
