import { HDRI_PRESETS, type HdriId } from "./lighting";
import { prepareEnvironment, type PreparedEnvironment } from "./environment-pixels";

/** Share CPU preparation across viewers, while GPU targets remain renderer-owned. */
export function createEnvironmentCache<T>(load: (id: HdriId) => Promise<T>, limit = 4) {
  const entries = new Map<HdriId, Promise<T>>();
  return (id: HdriId): Promise<T> => {
    const hit = entries.get(id);
    if (hit) { entries.delete(id); entries.set(id, hit); return hit; }
    const pending = Promise.resolve().then(() => load(id));
    entries.set(id, pending);
    while (entries.size > limit) entries.delete(entries.keys().next().value!);
    void pending.catch(() => { if (entries.get(id) === pending) entries.delete(id); });
    return pending;
  };
}

/**
 * "preview" is a 256×128 copy of the lighting (about 130 KB, made by scripts/make-lighting-previews.ts). Studio
 * lights the paper only through a blurred, prefiltered version of the photograph, so the preview looks almost the
 * same and lets Studio open before the full file (up to 2 MB) has arrived.
 */
export type EnvironmentQuality = "preview" | "full";
export const environmentFile = (id: HdriId, quality: EnvironmentQuality = "full") => {
  const file = (HDRI_PRESETS.find((p) => p.id === id) ?? HDRI_PRESETS[3]!).file;
  return quality === "preview" ? file.replace(/\.hdr$/, "-preview.hdr") : file;
};

// One worker prepares every lighting file; without workers (or if it fails) the work happens here instead.
let worker: Worker | null | undefined;
let nextRequest = 0;
const waiting = new Map<number, { resolve: (p: PreparedEnvironment) => void; reject: (e: Error) => void }>();
function lightingWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === "undefined" ? null : new Worker(new URL("./environment.worker.ts", import.meta.url), { type: "module" });
  } catch { worker = null; }
  if (worker) {
    worker.onmessage = (event: MessageEvent<{ id: number; prepared?: PreparedEnvironment; error?: string }>) => {
      const request = waiting.get(event.data.id);
      waiting.delete(event.data.id);
      if (event.data.prepared) request?.resolve(event.data.prepared);
      else request?.reject(new Error(event.data.error ?? "Lighting failed"));
    };
    worker.onerror = () => {
      worker = null;
      waiting.forEach((request) => request.reject(new Error("Lighting worker stopped")));
      waiting.clear();
    };
  }
  return worker;
}

async function prepareHere(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lighting file ${response.status}`);
  return prepareEnvironment(await response.arrayBuffer());
}

async function prepare(url: string): Promise<PreparedEnvironment> {
  const helper = lightingWorker();
  if (!helper) return prepareHere(url);
  try {
    return await new Promise<PreparedEnvironment>((resolve, reject) => {
      const id = ++nextRequest;
      waiting.set(id, { resolve, reject });
      helper.postMessage({ id, url: new URL(url, location.href).href });
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Lighting file")) throw error;
    return prepareHere(url);
  }
}

const full = createEnvironmentCache((id) => prepare(environmentFile(id, "full")));
const preview = createEnvironmentCache((id) => prepare(environmentFile(id, "preview")), 8);
export const loadPreparedEnvironment = (id: HdriId, quality: EnvironmentQuality = "full") => (quality === "preview" ? preview : full)(id);
