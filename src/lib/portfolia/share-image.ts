import type { Portfolio } from "./store";

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

/** Only the current PDF's derived cover may be served; never arbitrary storage paths. */
export function shareImageKey(p: Portfolio | null | undefined): string | undefined {
  const pdf = p?.pdf;
  if (p?.status !== "published" || !pdf || !/^pdf_[a-zA-Z0-9]+$/.test(pdf.blobKey)) return;
  const expected = `${pdf.blobKey}_cover.jpg`;
  return pdf.coverKey === expected ? expected : undefined;
}

export function shareImageUrl(p: Portfolio): string | undefined {
  const key = shareImageKey(p);
  return key ? `https://portfolia.site/api/public/portfolio-cover/${encodeURIComponent(p.code)}?v=${encodeURIComponent(key)}` : undefined;
}
