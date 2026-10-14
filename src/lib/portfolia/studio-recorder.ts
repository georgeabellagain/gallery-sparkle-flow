const encodingSupport = new Map<string, Promise<boolean>>();
async function supportsAvc(width: number, height: number) {
  const key = `${width}x${height}@60`;
  let support = encodingSupport.get(key);
  if (!support) {
    support = (async () => {
      const {canEncodeVideo, Quality} = await import("mediabunny");
      return canEncodeVideo("avc", {width,height,frameRate:60,quality:new Quality({bitrate:32_000_000})});
    })();
    encodingSupport.set(key,support);
    void support.catch(()=>encodingSupport.delete(key));
  }
  return support;
}
export async function studioCaptureCapability(width = 3840, height = 2160): Promise<"offline" | "realtime" | "unsupported"> {
  if (typeof VideoEncoder !== "undefined") {
    try {
      if (await supportsAvc(width,height))
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
/** Frame-count driven high-resolution/60 FPS MP4, with a real-time fallback on older browsers. */
export async function recordStudioClip(
  canvas: HTMLCanvasElement,
  action: () => Promise<void>,
  signal: AbortSignal,
  clock?: (frame?: () => Promise<void>) => void,
): Promise<Blob> {
  if (clock && typeof VideoEncoder !== "undefined") {
    const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality } =
      await import("mediabunny");
    const quality = new Quality({ bitrate: 32_000_000 });
    if (await supportsAvc(canvas.width,canvas.height)) {
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat(), target });
      const source = new CanvasSource(canvas, { codec: "avc", quality, keyFrameInterval: 1 });
      output.addVideoTrack(source, { frameRate: 60 });
      let frame = 0, lastYield = performance.now();
      const channel = typeof MessageChannel === "undefined" ? null : new MessageChannel();
      let resume: (()=>void) | undefined;
      if(channel)channel.port1.onmessage=()=>{const finish=resume;resume=undefined;finish?.();};
      const yieldToBrowser = () => channel ? new Promise<void>(resolve=>{resume=resolve;channel.port2.postMessage(null);}) : new Promise<void>(resolve=>setTimeout(resolve,0));
      const encode = async () => {
        signal.throwIfAborted();
        await source.add(frame++ / 60, 1 / 60);
        // Encoder backpressure is still awaited for every frame. Yield without
        // a nested timer on every frame, preserving UI/cancel responsiveness.
        if(frame%8===0 || performance.now()-lastYield>=32){await yieldToBrowser();lastYield=performance.now();}
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
        channel?.port1.close();channel?.port2.close();
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
  const stream = canvas.captureStream(60),
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
