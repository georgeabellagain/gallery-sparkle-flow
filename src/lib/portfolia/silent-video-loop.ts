/** Look up the presented frame by timestamp, including irregular frame holds. */
export function silentLoopFrame(frames: readonly { at: number }[], duration: number, seconds: number) {
  const at = Math.max(0, seconds) % duration;
  let lo = 0, hi = frames.length;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1;
    if (frames[mid]!.at <= at) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Decode a small silent loop once so playback wraps without a media seek. */
export async function decodeSilentVideoLoop(blob: Blob, signal: AbortSignal) {
  if (typeof VideoDecoder === "undefined") return null;
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const frames: { image: ImageBitmap; at: number }[] = [];
  let keep = false;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;
    const duration = await track.computeDuration();
    if (!(duration > 0 && duration <= 8)) return null;
    const width = await track.getDisplayWidth(), height = await track.getDisplayHeight();
    const scale = Math.min(1, 512 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const limit = Math.min(240, Math.floor(48 * 1024 * 1024 / (w * h * 4)));
    let start = 0, end = 0;
    for await (const frame of new CanvasSink(track, { width: w, height: h, poolSize: 1 }).canvases()) {
      if (signal.aborted || frames.length >= limit) return null;
      if (!frames.length) start = frame.timestamp;
      frames.push({ image: await createImageBitmap(frame.canvas), at: frame.timestamp - start });
      end = frame.timestamp - start + frame.duration;
    }
    if (frames.length < 2 || !(end > 0) || signal.aborted) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const surface = { canvas, version: 0 };
    let shown = -1;
    const paint = (seconds: number) => {
      const frame = silentLoopFrame(frames, end, seconds);
      if (shown === frame) return false;
      ctx.drawImage(frames[frame]!.image, 0, 0);
      shown = frame;
      surface.version++;
      return true;
    };
    paint(0);
    keep = true;
    return { surface, paint, dispose: () => frames.forEach(f => f.image.close()) };
  } finally {
    input.dispose();
    if (!keep) frames.forEach(f => f.image.close());
  }
}

export const silentVideoSurfaces = new WeakMap<HTMLVideoElement, { canvas: HTMLCanvasElement; version: number }>();
