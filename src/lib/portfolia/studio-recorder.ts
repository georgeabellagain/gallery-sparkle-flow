export async function studioCaptureCapability(width = 3840, height = 2160): Promise<"offline" | "realtime" | "unsupported"> {
  if (typeof VideoEncoder !== "undefined") {
    try {
      const { canEncodeVideo, Quality } = await import("mediabunny");
      if (
        await canEncodeVideo("avc", {
          width,
          height,
          frameRate: 30,
          quality: new Quality({ bitrate: 32_000_000 }),
        })
      )
        return "offline";
    } catch {
      /* Try real-time capture. */
    }
  }
  return typeof MediaRecorder !== "undefined" &&
    ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].some((t) =>
      MediaRecorder.isTypeSupported(t),
    )
    ? "realtime"
    : "unsupported";
}
/** Frame-count driven high-resolution/30 FPS MP4, with a real-time fallback on older browsers. */
export async function recordStudioClip(
  canvas: HTMLCanvasElement,
  action: () => Promise<void>,
  signal: AbortSignal,
  clock?: (frame?: () => Promise<void>) => void,
): Promise<Blob> {
  if (clock && typeof VideoEncoder !== "undefined") {
    const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } =
      await import("mediabunny");
    const quality = new Quality({ bitrate: 32_000_000 });
    if (await canEncodeVideo("avc", { width: canvas.width, height: canvas.height, frameRate: 30, quality })) {
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const source = new CanvasSource(canvas, { codec: "avc", quality, keyFrameInterval: 1 });
      output.addVideoTrack(source, { frameRate: 30 });
      let frame = 0;
      const encode = async () => {
        signal.throwIfAborted();
        await source.add(frame++ / 30, 1 / 30);
        await new Promise<void>((r) => setTimeout(r, 0));
      };
      try {
        await output.start();
        clock(encode);
        await encode();
        await action();
        await encode();
        signal.throwIfAborted();
        await output.finalize();
        if (!target.buffer) throw new Error("Video rendering failed.");
        return new Blob([target.buffer], { type: "video/mp4" });
      } finally {
        clock(undefined);
        if (output.state !== "finalized" && output.state !== "canceled") await output.cancel();
      }
    }
  }
  clock?.(undefined);
  if (typeof MediaRecorder === "undefined")
    throw new Error("Video rendering is not supported in this browser. Try Chrome or Edge.");
  const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (t) => MediaRecorder.isTypeSupported(t),
  );
  if (!type)
    throw new Error("Video rendering is not supported in this browser. Try Chrome or Edge.");
  signal.throwIfAborted();
  const stream = canvas.captureStream(30),
    chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 32_000_000 });
  let rejectRecording: (error: Error) => void = () => {};
  const finished = new Promise<Blob>((resolve, reject) => {
    rejectRecording = reject;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("Video encoding failed. Please try again."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  // Observe rejection immediately, even while the scene action is running.
  void finished.catch(() => {});
  const abort = () => {
    if (recorder.state !== "inactive") recorder.stop();
    rejectRecording(new Error("Rendering cancelled."));
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    recorder.start();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const interrupted = new Promise<never>((_, reject) => {
      const onAbort = () => reject(new Error("Rendering cancelled."));
      signal.addEventListener("abort", onAbort, { once: true });
      void finished.finally(() => signal.removeEventListener("abort", onAbort)).catch(() => {});
    });
    await Promise.race([action(), interrupted]);
    signal.throwIfAborted();
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await finished;
    if (!blob.size) throw new Error("The video was empty. Please try again.");
    return blob;
  } finally {
    signal.removeEventListener("abort", abort);
    if (recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
}
export function canvasStill(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not render this page."))),
      "image/webp",
      1,
    ),
  );
}
