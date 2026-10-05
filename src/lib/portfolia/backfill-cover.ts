import { getBlob, putBlob } from "./assets";
import { allPortfolios, getDoc, update } from "./store";
import { loadPdfjs } from "./pdf";
import { renderCover } from "./cover";

const pending = new Map<string, Promise<void>>();
/** Backfill on the owner's device, preserving identity and all saved viewer settings. */
export function backfillCover(code: string, pdfKey: string): Promise<void> {
  const id = `${code}:${pdfKey}`;
  if (pending.has(id)) return pending.get(id)!;
  const work = (async () => {
    const ownsCurrent = () => getDoc().account.signedIn && allPortfolios(getDoc()).some((p) => p.code === code && p.pdf?.blobKey === pdfKey);
    if (!ownsCurrent()) throw new Error("Sign in to generate this portfolio’s cover.");
    const blob = await getBlob(pdfKey);
    if (!blob) throw new Error("Couldn’t load the PDF. Please try again.");
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    let cover: Blob;
    try { cover = await renderCover(doc); } finally { await doc.destroy(); }
    if (!ownsCurrent()) throw new Error("The portfolio changed. Please try again.");
    const coverKey = `${pdfKey}_cover.jpg`;
    await putBlob(coverKey, cover);
    let matched = false;
    const saved = update((d) => {
      if (!d.account.signedIn) return d;
      const p = allPortfolios(d).find((p) => p.code === code && p.pdf?.blobKey === pdfKey);
      if (p?.pdf) { p.pdf = { ...p.pdf, coverKey }; matched = true; }
      return d;
    });
    if (!saved || !matched) throw new Error("Couldn’t save the cover. Please try again.");
  })().finally(() => pending.delete(id));
  pending.set(id, work);
  return work;
}
