import { VIDEO_MAX_MB } from "./page-extras";

/** Longest side of the converted video; GIFs are rarely bigger, and this keeps the file small. */
const MAX_SIDE = 1280;
/** Longest GIF converted, in seconds; anything longer is better exported as a video. */
const MAX_SECONDS = 60;
/** Browsers play GIF frames with a delay this short (or none) at 100 ms; the video keeps that pace. */
const MIN_FRAME_US = 20_000;

// The parts of WebCodecs' ImageDecoder used here (not in every TypeScript DOM library yet).
type DecodedImage = { image: VideoFrame };
type GifDecoder = {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  completed: Promise<void>;
  decode: (options: { frameIndex: number }) => Promise<DecodedImage>;
  close: () => void;
};
type GifDecoderClass = { new (init: { data: ReadableStream<Uint8Array> | ArrayBuffer; type: string }): GifDecoder; isTypeSupported: (type: string) => Promise<boolean> };

export const isGif = (file: File) => file.type === "image/gif" || /\.gif$/i.test(file.name);

export function gifFileProblem(file: File): string | null {
  if (file.size > VIDEO_MAX_MB * 1048576) return `This GIF is ${(file.size / 1048576).toFixed(1)} MB. Use one up to ${VIDEO_MAX_MB} MB.`;
  return null;
}

/** The video's pixel size: the GIF's shape within MAX_SIDE, rounded to even numbers (video encoders need them). */
export function videoSizeFor(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** A frame's time on screen in seconds, as browsers play GIFs: very short delays become 100 ms. */
export const frameSeconds = (durationUs: number | null | undefined) => (!durationUs || durationUs < MIN_FRAME_US ? 0.1 : durationUs / 1e6);

/**
 * Turns an animated GIF into a looping, silent video in the browser, so it plays on the page like any page video.
 * Transparent areas become white, like the paper. Nothing leaves the browser. Older browsers without WebCodecs
 * are asked for an MP4 instead.
 */
export async function gifToVideo(file: File, onProgress?: (done: number) => void): Promise<File> {
  const Decoder = (globalThis as { ImageDecoder?: GifDecoderClass }).ImageDecoder;
  if (!Decoder || typeof VideoEncoder === "undefined" || !(await Decoder.isTypeSupported("image/gif").catch(() => false)))
    throw new Error("This browser can’t turn GIFs into video. Try Chrome, Edge or Safari 17+, or export the GIF as an MP4 and add that.");
  const { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, canEncodeVideo } = await import("mediabunny");
  const decoder = new Decoder({ data: await file.arrayBuffer(), type: "image/gif" });
  try {
    await decoder.tracks.ready;
    const frames = decoder.tracks.selectedTrack?.frameCount ?? 0;
    if (!frames) throw new Error("This GIF has no frames.");
    const first = await decoder.decode({ frameIndex: 0 });
    const size = videoSizeFor(first.image.displayWidth, first.image.displayHeight);
    first.image.close();
    // H.264 MP4 plays everywhere; VP9/VP8 WebM is the fallback where the browser can't encode H.264.
    const codec = (await canEncodeVideo("avc", { ...size, bitrate: QUALITY_HIGH })) ? "avc" : (await canEncodeVideo("vp9", { ...size, bitrate: QUALITY_HIGH })) ? "vp9" : (await canEncodeVideo("vp8", { ...size, bitrate: QUALITY_HIGH })) ? "vp8" : null;
    if (!codec) throw new Error("This browser can’t make a video from the GIF. Export it as an MP4 and add that instead.");
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d")!;
    const target = new BufferTarget();
    const mp4 = codec === "avc";
    const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target });
    // A key frame every second keeps looping and seeking smooth.
    const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 1 });
    output.addVideoTrack(source);
    try {
      await output.start();
      let t = 0;
      for (let i = 0; i < frames; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        const seconds = frameSeconds(image.duration);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.close();
        await source.add(t, seconds);
        t += seconds;
        if (t > MAX_SECONDS) throw new Error(`This GIF runs longer than ${MAX_SECONDS} seconds. Export it as an MP4 and add that instead.`);
        onProgress?.((i + 1) / frames);
      }
      await output.finalize();
    } finally {
      if (output.state !== "finalized" && output.state !== "canceled") await output.cancel();
    }
    if (!target.buffer) throw new Error("The GIF couldn’t be converted. Please try again.");
    const name = file.name.replace(/\.gif$/i, "") + (mp4 ? ".mp4" : ".webm");
    return new File([target.buffer], name, { type: mp4 ? "video/mp4" : "video/webm" });
  } finally {
    decoder.close();
  }
}
