import { mediaClipPath } from "@/lib/portfolia/media-crop";
import { useEffect, useRef, useState } from "react";
import { getBlob } from "@/lib/portfolia/assets";
import { animationFrameAt, drawAnimationFrame, loadAnimation, startAnimation, stopAnimation, type LoadedAnimation } from "@/lib/portfolia/page-animation";
import { stickerLabel, type PageSticker } from "@/lib/portfolia/page-extras";

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One animation on a page, filling its square box. It is drawn frame by frame from the page's clock, the same clock
 * its copy on turning paper uses (sticker-layer.tsx), so the two hand over without a jump. `interactive` is the
 * reader's page: there "open" plays once as the page appears and "tap" plays when pressed. In the editor every
 * animation simply loops, so its motion can be judged while it is placed.
 */
export function PageAnimation({ sticker, interactive = false, onPaper = false }: {
  sticker: PageSticker;
  interactive?: boolean;
  /**
   * In the 3D book the animation is drawn on the paper itself (so the page's light and shade fall on it and it never
   * changes hands in a turn). This copy then draws nothing: it only starts "open" animations and takes presses.
   */
  onPaper?: boolean;
}) {
  const key = sticker.image?.key;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [animation, setAnimation] = useState<LoadedAnimation | null>(null);
  // Browsers that can't read frames show the file itself, which moves on its own.
  const [fileUrl, setFileUrl] = useState<string>();
  const play = interactive ? sticker.play ?? "loop" : "loop";
  const name = stickerLabel(sticker);

  useEffect(() => {
    if (!key) return;
    let live = true;
    void loadAnimation(key).then((a) => { if (live) setAnimation(a); });
    return () => { live = false; };
  }, [key]);

  useEffect(() => {
    if (!key || !animation?.stillOnly) return;
    let url: string | undefined, live = true;
    void getBlob(key).then((blob) => { if (blob && live) { url = URL.createObjectURL(animation?.video ? new Blob([blob], { type: "video/mp4" }) : blob); setFileUrl(url); } });
    return () => { live = false; if (url) URL.revokeObjectURL(url); setFileUrl(undefined); };
  }, [key, animation?.stillOnly, animation?.video]);

  // "Open" starts as the page appears and is forgotten when it goes, so it plays again next time.
  useEffect(() => {
    if (play !== "open" || !animation) return;
    startAnimation(sticker.id, performance.now() / 1000);
    return () => stopAnimation(sticker.id);
  }, [play, animation, sticker.id]);
  useEffect(() => (play === "tap" ? () => stopAnimation(sticker.id) : undefined), [play, sticker.id]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !animation || animation.stillOnly || onPaper) return;
    const side = Math.max(animation.width, animation.height);
    el.width = side;
    el.height = side;
    const ctx = el.getContext("2d")!;
    let shown: ImageBitmap | null = null, frame = 0;
    const draw = (now: number | undefined) => {
      const next = animationFrameAt({ id: sticker.id, play }, animation, now);
      if (next === shown) return;
      shown = next;
      ctx.clearRect(0, 0, side, side);
      drawAnimationFrame(ctx, next, 0, 0, side, Boolean(sticker.flip));
    };
    if (reducedMotion()) { draw(undefined); return; }
    const tick = (now: number) => { frame = requestAnimationFrame(tick); draw(now / 1000); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animation, play, sticker.id, sticker.flip, onPaper]);

  // Browsers that can't read frames show the file itself moving, even over the 3D book.
  const picture = animation?.stillOnly && fileUrl && !(onPaper && animation.video)
    ? animation.video
      ? <video ref={video} src={fileUrl} muted playsInline preload="auto" aria-hidden
          autoPlay={play !== "tap" && !reducedMotion()} loop={play === "loop"}
          onEnded={play === "tap" ? (e) => { e.currentTarget.currentTime = 0; } : undefined}
          className="h-full w-full object-contain" style={sticker.flip ? { transform: "scaleX(-1)" } : undefined} />
      : <img src={fileUrl} alt="" draggable={false} className="h-full w-full object-contain" style={sticker.flip ? { transform: "scaleX(-1)" } : undefined} />
    : onPaper ? null : <canvas ref={canvas} aria-hidden className="h-full w-full" />;
  const clipped = <span className="block h-full w-full" style={{ clipPath: mediaClipPath(sticker.crop) }}>{picture}</span>;
  if (play !== "tap") return <span role="img" aria-label={name} className="block h-full w-full">{clipped}</span>;
  return (
    <button type="button" aria-label={`Play ${name}`} title="Press to play"
      className="pointer-events-auto block h-full w-full cursor-pointer rounded-lg bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      // The press is for the animation, not for turning the page underneath.
      onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); startAnimation(sticker.id, performance.now() / 1000); if (video.current && !reducedMotion()) { video.current.currentTime = 0; void video.current.play().catch(() => {}); } }}>
      {clipped}
    </button>
  );
}
