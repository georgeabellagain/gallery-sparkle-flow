import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useBlob, useObjectUrl } from "./Chrome";
import { cn } from "@/lib/utils";
import type { PageSlideshow } from "@/lib/portfolia/page-extras";

function Slide({ imageKey, fit, className, style }: { imageKey: string; fit: PageSlideshow["fit"]; className?: string; style?: React.CSSProperties }) {
  const url = useObjectUrl(useBlob(imageKey));
  return url
    ? <img src={url} alt="" draggable={false} className={cn("absolute inset-0 h-full w-full select-none", fit === "cover" ? "object-cover" : "object-contain", className)} style={style} />
    : <span className={cn("absolute inset-0 animate-pulse bg-black/10", className)} style={style} />;
}

/**
 * The pictures of a slideshow, changing by themselves every few seconds (paused while the pointer rests on them, and
 * never for readers who turn motion off), with arrows and dots to step through. `still` shows the first picture only.
 */
export function SlideshowFrame({ slideshow, still = false }: { slideshow: PageSlideshow; still?: boolean }) {
  const count = slideshow.images.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { setIndex((i) => (count ? i % count : 0)); }, [count]);
  useEffect(() => {
    if (still || paused || count < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), slideshow.interval * 1000);
    return () => clearInterval(timer);
  }, [still, paused, count, slideshow.interval]);
  if (!count) {
    return <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/5 text-[11px] text-black/50"><Images className="size-5" />Add pictures</span>;
  }
  const go = (step: number) => setIndex((i) => (i + step + count) % count);
  return (
    <span className="absolute inset-0 block overflow-hidden" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      {slideshow.images.map((key, i) => {
        const shown = i === index;
        const offset = ((i - index + count) % count);
        return (
          <Slide key={`${key}:${i}`} imageKey={key} fit={slideshow.fit} className="transition-[opacity,transform] duration-700 ease-out"
            style={slideshow.transition === "fade"
              ? { opacity: shown ? 1 : 0 }
              : { transform: `translateX(${shown ? 0 : offset === 1 ? 100 : -100}%)`, opacity: shown || offset === 1 || offset === count - 1 ? 1 : 0 }} />
        );
      })}
      {!still && count > 1 && <>
        <button type="button" aria-label="Previous picture" onClick={() => go(-1)} className="pointer-events-auto absolute left-[3%] top-1/2 flex aspect-square w-[9%] min-w-6 max-w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow transition-opacity hover:bg-white"><ChevronLeft className="size-[60%]" /></button>
        <button type="button" aria-label="Next picture" onClick={() => go(1)} className="pointer-events-auto absolute right-[3%] top-1/2 flex aspect-square w-[9%] min-w-6 max-w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow transition-opacity hover:bg-white"><ChevronRight className="size-[60%]" /></button>
        <span className="absolute inset-x-0 bottom-[4%] flex justify-center gap-1.5">
          {slideshow.images.map((key, i) => (
            <button key={`${key}:${i}`} type="button" aria-label={`Picture ${i + 1} of ${count}`} aria-current={i === index || undefined} onClick={() => setIndex(i)}
              className={cn("pointer-events-auto size-1.5 rounded-full bg-white/60 shadow transition-all aria-[current]:w-4 aria-[current]:bg-white")} />
          ))}
        </span>
      </>}
    </span>
  );
}

/** A slideshow placed on a page (its box positioned as fractions of the page). */
export function PageSlideshowMark({ slideshow }: { slideshow: PageSlideshow }) {
  return (
    <div role="group" aria-roledescription="slideshow" aria-label="Slideshow" className="pointer-events-auto absolute overflow-hidden rounded-[2px] shadow-sm"
      style={{ left: `${slideshow.x * 100}%`, top: `${slideshow.y * 100}%`, width: `${slideshow.width * 100}%`, height: `${slideshow.height * 100}%` }}>
      <SlideshowFrame slideshow={slideshow} />
    </div>
  );
}
