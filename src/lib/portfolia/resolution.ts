/**
 * How sharp the flipbook's pages can be.
 *
 * A page is drawn at the detail of the images inside the PDF (so nothing is softer than the file you uploaded),
 * and never below what suits the screen, up to the most this device can safely hold. A sheet that is a two-page
 * spread keeps the sheet's detail across both pages.
 */

export type DeviceTier = "phone" | "small" | "standard" | "large";

/** Graphics memory page pictures may hold at once (mipmaps included). Beyond it the browser may take the 3D view away. */
export const GPU_BYTES: Record<DeviceTier, number> = {
  phone: 128 * 1024 * 1024,
  small: 224 * 1024 * 1024,
  standard: 320 * 1024 * 1024,
  large: 512 * 1024 * 1024,
};
/** Ordinary memory for the prepared pages. */
export const CPU_BYTES: Record<DeviceTier, number> = {
  phone: 160 * 1024 * 1024,
  small: 256 * 1024 * 1024,
  standard: 360 * 1024 * 1024,
  large: 700 * 1024 * 1024,
};

export function deviceTier(): DeviceTier {
  if (typeof window !== "undefined" && window.innerWidth < 720) return "phone";
  const memory = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
  if (!memory) return "standard";
  if (memory >= 8) return "large";
  if (memory < 4) return "small";
  return "standard";
}

/** Bytes one page picture takes on the graphics card: 4 bytes a pixel, a third more for the mipmaps. */
export const gpuBytesOf = (width: number, height: number) => width * height * 4 * 1.34;

/**
 * The longest side a page picture may have. `leafRatio` is its long side over its short side (at least 1).
 * Four pictures must fit on the card at once (two on show, two on the turning sheet), and at least ten must
 * fit in ordinary memory, so a book can be turned without waiting on a page.
 */
export function longSideCap(opts: { leafRatio: number; tier?: DeviceTier; maxTexture?: number }): number {
  const tier = opts.tier ?? deviceTier();
  const ratio = Math.max(1, opts.leafRatio);
  const gpu = Math.sqrt((GPU_BYTES[tier] / (4 * 4 * 1.34)) * ratio);
  const cpu = Math.sqrt(((CPU_BYTES[tier] / 10) * ratio) / 4);
  const texture = (opts.maxTexture ?? 4096) * 0.9;
  return Math.floor(Math.min(gpu, cpu, texture, 8192));
}

/** The long side to draw a page at: the PDF's own detail, but never below the screen's need, and never above the cap. */
export function longSideFor(opts: { screenLong: number; density: number; leafLongPt: number; cap: number }): number {
  const native = opts.density > 0 ? opts.density * opts.leafLongPt : 0;
  return Math.max(1200, Math.min(Math.max(opts.screenLong, native), opts.cap));
}

type Matrix = [number, number, number, number, number, number];
const times = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

interface OperatorNames {
  save: number;
  restore: number;
  transform: number;
  paintImageXObject: number;
  paintInlineImageXObject: number;
  paintImageMaskXObject: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
}
interface PageLike {
  getViewport(o: { scale: number }): { width: number; height: number };
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}
interface DocLike {
  numPages: number;
  getPage(n: number): Promise<PageLike>;
}

/**
 * How many pixels per PDF point the images in the file really have: the most detailed picture of any real size
 * on the pages looked at. 0 when there are no pictures (a vector-only file looks sharp at any size) or this can't be read.
 */
export async function detectDensity(doc: DocLike, OPS: OperatorNames, maxPages = 6): Promise<number> {
  const count = Math.min(maxPages, doc.numPages);
  const picks = [...new Set(Array.from({ length: count }, (_, i) => Math.round(1 + (i * (doc.numPages - 1)) / Math.max(1, count - 1))))];
  const inspect = async (number: number) => {
    let best = 0;
    try {
      const page = await doc.getPage(number);
      const view = page.getViewport({ scale: 1 });
      const area = view.width * view.height;
      const { fnArray, argsArray } = await page.getOperatorList();
      let ctm: Matrix = [1, 0, 0, 1, 0, 0];
      const stack: Matrix[] = [];
      for (let i = 0; i < fnArray.length; i++) {
        const op = fnArray[i];
        const args = argsArray[i] as unknown[];
        if (op === OPS.save) stack.push(ctm);
        else if (op === OPS.restore) ctm = stack.pop() ?? ctm;
        else if (op === OPS.transform) ctm = times(ctm, args as unknown as Matrix);
        else if (op === OPS.paintFormXObjectBegin) {
          stack.push(ctm);
          if (Array.isArray(args[0]) && args[0].length === 6) ctm = times(ctm, args[0] as Matrix);
        } else if (op === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
        else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject || op === OPS.paintImageMaskXObject) {
          const pixels =
            typeof args[1] === "number" && typeof args[2] === "number"
              ? [args[1], args[2]]
              : [(args[0] as { width?: number })?.width, (args[0] as { height?: number })?.height];
          const [pw, ph] = pixels;
          if (!pw || !ph) continue;
          const widthPt = Math.hypot(ctm[0], ctm[1]);
          const heightPt = Math.hypot(ctm[2], ctm[3]);
          if (widthPt < 1 || heightPt < 1) continue;
          // Icons and textures do not set the page's detail; only pictures of real size do.
          if ((widthPt * heightPt) / area < 0.03 || Math.max(pw, ph) < 100) continue;
          best = Math.max(best, Math.min(8, Math.max(pw / widthPt, ph / heightPt)));
        }
      }
    } catch {
      /* a page that can't be read is skipped */
    }
    return best;
  };
  // Two workers inspect the same sample without six sequential worker trips.
  let next = 0;
  const results: number[] = [];
  const worker = async () => {
    while (next < picks.length) results.push(await inspect(picks[next++]!));
  };
  await Promise.all([worker(), worker()]);
  return Math.max(0, ...results);
}

