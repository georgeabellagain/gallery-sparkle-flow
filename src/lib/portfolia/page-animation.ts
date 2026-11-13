import { getBlob } from "./assets";
import { ANIMATION_MAX_MB, MP4_ANIMATION_MAX_MB, type AnimationPlay, type PageSticker } from "./page-extras";

/**
 * Page animations: small moving pictures (animated GIF, WebP or PNG) that sit on a page with their own see-through
 * background. Their frames are read once in the browser, so the same picture can be drawn flat over a still page and
 * onto the paper of a turning one, at the same moment of its loop, and can be held, played once or played on a press.
 */

/** Frames kept for one animation: longer ones are cut here (about ten seconds at 24 a second). */
export const MAX_ANIMATION_FRAMES = 240;
/** Longest side a frame is kept at, and the memory one animation's frames may use together. */
const MAX_SIDE = 512;
const MEMORY_BYTES = 40 * 1048576;
const MIN_SIDE = 96;

export type AnimationKind = "image/gif" | "image/webp" | "image/png" | "video/mp4";
/** What a file really is, from its first bytes (stored files do not always keep their type). */
export function animationKind(bytes: Uint8Array): AnimationKind | null {
  const text = (from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length));
  if (bytes.length >= 12 && text(4, 4) === "ftyp" && /^(?:isom|iso[2-9]|mp4[12]|avc1|M4V |dash|MSNV)$/.test(text(8, 4))) return "video/mp4";
  if (text(0, 4) === "GIF8") return "image/gif";
  if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") return "image/webp";
  if (bytes[0] === 0x89 && text(1, 3) === "PNG") return "image/png";
  return null;
}

/** Why a chosen file can't be an animation, or null when it can. */
export function animationFileProblem(file: { size: number; name: string }, kind: AnimationKind | null): string | null {
  if (!kind) return "Use an animated GIF, WebP or PNG, or an MP4.";
  const cap = kind === "video/mp4" ? MP4_ANIMATION_MAX_MB : ANIMATION_MAX_MB;
  if (file.size > cap * 1048576) return `This file is ${(file.size / 1048576).toFixed(1)} MB. This animation format can be up to ${cap} MB.`;
  return null;
}

/** A frame's time on screen in seconds, as browsers play them: very short delays become 100 ms. */
export const animationFrameSeconds = (durationUs: number | null | undefined) => (!durationUs || durationUs < 20_000 ? 0.1 : durationUs / 1e6);

/** The size frames are kept at: the picture's shape, within MAX_SIDE and within the memory allowed for all frames. */
export function animationFrameSize(width: number, height: number, frames: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const byMemory = Math.sqrt(MEMORY_BYTES / (4 * Math.max(1, frames) * Math.max(1, width * height)));
  const scale = Math.min(1, maxSide / Math.max(width, height), byMemory);
  const floor = Math.min(1, MIN_SIDE / Math.max(width, height));
  const s = Math.max(scale, floor);
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

/**
 * Which frame shows `seconds` into playing. Looping goes round for ever; otherwise it stops on the last frame
 * ("open") or comes back to rest on the first ("tap").
 */
export function animationFrameIndex(durations: readonly number[], seconds: number, loop: boolean, rest: "last" | "first" = "last"): number {
  const total = durations.reduce((sum, d) => sum + d, 0);
  if (durations.length < 2 || !(total > 0) || !Number.isFinite(seconds) || seconds <= 0) return 0;
  if (!loop && seconds >= total) return rest === "last" ? durations.length - 1 : 0;
  let t = loop ? seconds % total : seconds;
  for (let i = 0; i < durations.length; i++) {
    t -= durations[i]!;
    if (t < 0) return i;
  }
  return durations.length - 1;
}

export type LoadedAnimation = {
  frames: ImageBitmap[];
  /** Seconds each frame shows for. */
  durations: number[];
  width: number;
  height: number;
  /** The browser could not read the frames: only the first is here, and the page shows the file itself moving. */
  stillOnly: boolean;
  video?: true;
  media?: HTMLVideoElement;
};

// The parts of WebCodecs' ImageDecoder used here (not in every TypeScript DOM library yet).
type Decoder = {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  completed: Promise<void>;
  decode: (options: { frameIndex: number }) => Promise<{ image: VideoFrame }>;
  close: () => void;
};
type DecoderClass = { new (init: { data: ArrayBuffer; type: string }): Decoder; isTypeSupported: (type: string) => Promise<boolean> };

/** Native playback for browsers without WebCodecs, with a still for the turning page. */
async function videoStill(blob: Blob): Promise<LoadedAnimation> {
  const el = document.createElement("video");
  const url = URL.createObjectURL(blob);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retained = false;
  try {
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      el.onloadeddata = () => resolve();
      el.onerror = () => reject(new Error("MP4 could not be decoded"));
      timer = setTimeout(() => reject(new Error("MP4 timed out")), 6000);
      el.src = url;
    });
    const size = animationFrameSize(el.videoWidth, el.videoHeight, 1, 1024);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")!.drawImage(el, 0, 0, size.width, size.height);
    const picture = await createImageBitmap(canvas);
    retained = true;
    el.onloadeddata = null;
    el.onerror = null;
    return { frames: [picture], durations: [1], width: picture.width, height: picture.height, stillOnly: true, video: true, media: el };
  } finally {
    clearTimeout(timer);
    if (!retained) { el.removeAttribute("src"); el.load(); URL.revokeObjectURL(url); }
  }
}

async function readMp4(blob: Blob): Promise<LoadedAnimation> {
  if (typeof VideoDecoder === "undefined") return videoStill(blob);
  const { Input, BlobSource, MP4, CanvasSink } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(blob), formats: [MP4] });
  const frames: ImageBitmap[] = [];
  let success = false;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return videoStill(blob);
    const start = await track.getFirstTimestamp();
    const length = await track.computeDuration() - start;
    if (!(length > 0 && length <= 15)) return videoStill(blob);
    const count = Math.max(2, Math.min(MAX_ANIMATION_FRAMES, Math.ceil(length * 20)));
    const step = length / count;
    const size = animationFrameSize(await track.getDisplayWidth(), await track.getDisplayHeight(), count, 1024);
    const sink = new CanvasSink(track, { ...size, poolSize: 1 });
    for await (const sample of sink.canvasesAtTimestamps(Array.from({ length: count }, (_, i) => start + i * step))) {
      if (!sample) throw new Error("Missing MP4 animation frame");
      frames.push(await createImageBitmap(sample.canvas));
    }
    if (frames.length !== count) throw new Error("Incomplete MP4 animation");
    success = true;
    return { frames, durations: Array<number>(count).fill(step), ...size, stillOnly: false, video: true };
  } catch {
    return videoStill(blob);
  } finally {
    if (!success) frames.forEach(frame => frame.close());
    input.dispose();
  }
}

async function readFrames(blob: Blob): Promise<LoadedAnimation | null> {
  const data = await blob.arrayBuffer();
  const kind = animationKind(new Uint8Array(data, 0, Math.min(16, data.byteLength)));
  if (!kind) return null;
  const typed = new Blob([data], { type: kind });
  if (kind === "video/mp4") return readMp4(typed);
  const still = async (): Promise<LoadedAnimation> => {
    const picture = await createImageBitmap(typed);
    return { frames: [picture], durations: [1], width: picture.width, height: picture.height, stillOnly: true };
  };
  const Reader = (globalThis as { ImageDecoder?: DecoderClass }).ImageDecoder;
  if (!Reader || !(await Reader.isTypeSupported(kind).catch(() => false))) return still();
  const decoder = new Reader({ data, type: kind });
  try {
    await decoder.tracks.ready;
    await decoder.completed.catch(() => {});
    const count = Math.min(MAX_ANIMATION_FRAMES, decoder.tracks.selectedTrack?.frameCount ?? 0);
    if (count < 1) return still();
    const frames: ImageBitmap[] = [], durations: number[] = [];
    let size: { width: number; height: number } | null = null;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        size ??= animationFrameSize(image.displayWidth, image.displayHeight, count);
        frames.push(await createImageBitmap(image, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "high" }));
        durations.push(animationFrameSeconds(image.duration));
      } finally {
        image.close();
      }
    }
    return { frames, durations, width: size!.width, height: size!.height, stillOnly: false };
  } catch {
    return still().catch(() => null);
  } finally {
    decoder.close();
  }
}

const loading = new Map<string, Promise<LoadedAnimation | null>>();
const loaded = new Map<string, LoadedAnimation | null>();
/** Reads an animation's frames once; later calls (the page, its turning copy, a duplicate) share them. */
export function loadAnimation(key: string): Promise<LoadedAnimation | null> {
  let p = loading.get(key);
  if (!p) {
    p = getBlob(key).then((blob) => (blob ? readFrames(blob) : null)).catch(() => null).then((a) => {
      loaded.set(key, a);
      // A picture that wasn't there yet (still arriving from storage) is looked for again next time.
      if (!a) loading.delete(key);
      return a;
    });
    loading.set(key, p);
  }
  return p;
}
/** The frames, if they have been read already (drawing never waits). */
export const readyAnimation = (key: string) => loaded.get(key) ?? null;

// When each "open" or "tap" animation last started (seconds on the page's clock), shared by its flat and turning copies.
const starts = new Map<string, number>();
export const startAnimation = (id: string, now: number) => { starts.set(id, now); };
export const stopAnimation = (id: string) => { starts.delete(id); };

/** Which frame of a sticker's animation shows at `now` (seconds on the page's clock); `now` undefined is at rest. */
export function animationFrameNumber(sticker: Pick<PageSticker, "id" | "play">, animation: LoadedAnimation, now: number | undefined): number {
  const play: AnimationPlay = sticker.play ?? "loop";
  if (now === undefined) return 0;
  if (play === "loop") return animationFrameIndex(animation.durations, now, true);
  const started = starts.get(sticker.id);
  return started === undefined ? 0 : animationFrameIndex(animation.durations, now - started, false, play === "open" ? "last" : "first");
}
/** The frame of a sticker's animation to draw at `now`. */
export function animationFrameAt(sticker: Pick<PageSticker, "id" | "play">, animation: LoadedAnimation, now: number | undefined): ImageBitmap {
  return animation.frames[animationFrameNumber(sticker, animation, now)] ?? animation.frames[0]!;
}

/** Draws a frame inside a square box, keeping its shape (like object-fit: contain), mirrored when asked. */
export function drawAnimationFrame(ctx: CanvasRenderingContext2D, frame: ImageBitmap | HTMLVideoElement, x: number, y: number, size: number, flip = false) {
  const width = "videoWidth" in frame ? frame.videoWidth : frame.width;
  const height = "videoHeight" in frame ? frame.videoHeight : frame.height;
  if (!width || !height) return;
  const scale = Math.min(size / width, size / height);
  const w = width * scale, h = height * scale;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(frame, -w / 2, -h / 2, w, h);
  ctx.restore();
}


/** Native MP4 decoding still paints into the page texture, including on a turning sheet. */
export function paperAnimationFrame(sticker: PageSticker, animation: LoadedAnimation, time?: number) {
  const media = animation.media;
  if (!media || time === undefined) { media?.pause(); return animationFrameAt(sticker, animation, time); }
  const play = sticker.play ?? "loop";
  const start = starts.get(sticker.id);
  if (play !== "loop" && start === undefined) return animation.frames[0]!;
  const elapsed = start === undefined ? 0 : Math.max(0, time - start);
  if (play === "tap" && elapsed >= media.duration) { media.pause(); return animation.frames[0]!; }
  media.loop = play === "loop";
  if (play !== "loop" && elapsed < .1 && media.currentTime > .15) media.currentTime = 0;
  if (media.paused && (!media.ended || media.loop || elapsed < .1)) void media.play().catch(() => {});
  return media.readyState >= 2 ? media : animation.frames[0]!;
}

export function pausePaperAnimation(key: string) { loaded.get(key)?.media?.pause(); }
