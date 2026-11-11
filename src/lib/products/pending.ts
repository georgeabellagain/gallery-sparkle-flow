/**
 * A PDF dropped on a landing page before the visitor has an account (or while the product is being made). The file
 * waits in this browser only: the blob in IndexedDB, its name and size in sessionStorage. Nothing is uploaded until the
 * product editor takes it. Why: products need an account because the file goes to private storage.
 */
export const PENDING_KEY = "pending-product-pdf";
export const PENDING_META_KEY = "pf-pending-product-pdf";
/** The largest PDF any plan allows (Business); the editor then applies the visitor's own plan limit. */
export const PENDING_MAX_MB = 250;
/** A file kept while the visitor signs in, or reads an upgrade prompt, is forgotten after this long. */
export const PENDING_TTL_MS = 10 * 60 * 1000;

export type PendingMeta = { name: string; size: number; at: number };
export type PendingDeps = {
  put: (key: string, blob: Blob) => Promise<void>;
  get: (key: string) => Promise<Blob | undefined>;
  remove: (key: string) => Promise<void>;
  session: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  now: () => number;
};

/** The message to show for a file that can never be a product, or null when it may continue. */
export function pendingPdfProblem(file: { name: string; size: number; type?: string }): string | null {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return "Please choose a PDF file.";
  if (file.size > PENDING_MAX_MB * 1048576) return `This PDF is over ${PENDING_MAX_MB} MB, the largest any plan allows. Export a smaller copy and try again.`;
  if (file.size === 0) return "This PDF is empty. Choose a different file.";
  return null;
}

async function defaults(): Promise<PendingDeps> {
  const assets = await import("@/lib/portfolia/assets");
  return { put: assets.putLocalBlob, get: assets.getBlob, remove: assets.deleteBlob, session: window.sessionStorage, now: Date.now };
}

function readMeta(deps: Pick<PendingDeps, "session" | "now">): PendingMeta | null {
  try {
    const raw = deps.session.getItem(PENDING_META_KEY);
    if (!raw) return null;
    const meta = JSON.parse(raw) as Partial<PendingMeta>;
    if (typeof meta.name !== "string" || typeof meta.size !== "number" || typeof meta.at !== "number") return null;
    if (deps.now() - meta.at > PENDING_TTL_MS) return null;
    return { name: meta.name, size: meta.size, at: meta.at };
  } catch {
    return null;
  }
}

/** Whether a file is waiting (and not too old). Cheap and synchronous: the product list uses it to decide what to do on load. */
export function hasPendingProductPdf(deps: Pick<PendingDeps, "session" | "now"> = { session: window.sessionStorage, now: Date.now }): boolean {
  return readMeta(deps) !== null;
}

export async function keepPendingProductPdf(file: File, injected?: PendingDeps): Promise<{ ok: true } | { ok: false; message: string }> {
  const problem = pendingPdfProblem(file);
  if (problem) return { ok: false, message: problem };
  const deps = injected ?? (await defaults());
  try {
    await deps.put(PENDING_KEY, file);
    deps.session.setItem(PENDING_META_KEY, JSON.stringify({ name: file.name, size: file.size, at: deps.now() } satisfies PendingMeta));
    return { ok: true };
  } catch {
    return { ok: false, message: "Your browser could not keep this PDF. Free some storage and try again." };
  }
}

/** Returns the waiting file and forgets it, so a reload never uploads it twice. */
export async function takePendingProductPdf(injected?: PendingDeps): Promise<File | null> {
  const deps = injected ?? (await defaults());
  const meta = readMeta(deps);
  deps.session.removeItem(PENDING_META_KEY);
  if (!meta) { void deps.remove(PENDING_KEY).catch(() => {}); return null; }
  try {
    const blob = await deps.get(PENDING_KEY);
    void deps.remove(PENDING_KEY).catch(() => {});
    return blob ? new File([blob], meta.name, { type: "application/pdf" }) : null;
  } catch {
    return null;
  }
}
