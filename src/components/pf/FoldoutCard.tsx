import { useEffect, useRef, useState } from "react";
import {
  foldoutSurfaces,
  type Foldout,
  type FoldoutSurface,
} from "@/lib/portfolia/foldouts";
import {
  loadNoteFonts,
  loadNoteImages,
  paintNoteSurface,
} from "@/lib/portfolia/foldout-paint";

export function NoteSurface({
  side,
  label,
}: {
  side: FoldoutSurface;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    let cancelled = false;
    let images: Awaited<ReturnType<typeof loadNoteImages>> = new Map();
    const paint = () => {
      if (cancelled) return;
      const { width, height } = canvas.getBoundingClientRect();
      // CSS layout dimensions remain stable through the hinge's 3D transform.
      const w = canvas.clientWidth || width,
        h = canvas.clientHeight || height;
      canvas.width = Math.max(1, Math.round(w * 2));
      canvas.height = Math.max(1, Math.round(h * 2));
      paintNoteSurface(
        canvas.getContext("2d")!,
        canvas.width,
        canvas.height,
        side,
        images,
      );
    };
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    paint();
    void loadNoteFonts([side]).then(() => paint());
    void loadNoteImages(side.imageKey ? [side.imageKey] : []).then((next) => {
      if (cancelled) {
        next.forEach((i) => i.close());
        return;
      }
      images = next;
      paint();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
      images.forEach((i) => i.close());
    };
  }, [JSON.stringify(side)]);
  return (
    <canvas
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="block h-full w-full"
    />
  );
}
type CardProps = {
  item: Foldout;
  baked?: boolean;
  sceneRendered?: boolean;
  onProgress?: (progress: number) => void;
  /** Lets the book close this note (and wait for it) before a page turns away from it. */
  closers?: { current: Map<string, () => Promise<void> | null> };
};
export function StoredFoldout(props: CardProps) {
  return <FoldoutCard {...props} />;
}
export function FoldoutCard({
  item,
  baked = false,
  sceneRendered = false,
  onProgress,
  closers,
}: CardProps) {
  const [progress, setProgress] = useState(0);
  const current = useRef(0);
  const frame = useRef(0);
  const callback = useRef(onProgress);
  callback.current = onProgress;
  const drag = useRef<{
    x: number;
    y: number;
    start: number;
    size: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const vertical = item.hinge === "top" || item.hinge === "bottom";
  const negative = item.hinge === "left" || item.hinge === "top";
  const { outside, inside } = foldoutSurfaces(item);
  const update = (p: number) => {
    current.current = p;
    setProgress(p);
    callback.current?.(p);
  };
  // A closing animation that is cut short (the card is removed) still reports done, so nothing waits on it forever.
  const waiting = useRef(new Set<() => void>());
  const settle = (target: number, duration = 420) =>
    new Promise<void>((finish) => {
      const done = () => {
        waiting.current.delete(done);
        finish();
      };
      waiting.current.add(done);
      cancelAnimationFrame(frame.current);
      if (
        duration <= 0 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        update(target);
        done();
        return;
      }
      const start = current.current,
        time = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - time) / duration);
        update(start + (target - start) * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame.current = requestAnimationFrame(step);
        else done();
      };
      frame.current = requestAnimationFrame(step);
    });
  useEffect(() => {
    if (!closers) return;
    const map = closers.current;
    // Closing is quick: the page is about to turn, so the note tucks away first.
    const close = () => (current.current > 0 ? settle(0, 240) : null);
    map.set(item.id, close);
    return () => {
      if (map.get(item.id) === close) map.delete(item.id);
    };
  }, [item.id, closers]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      waiting.current.forEach((done) => done());
      callback.current?.(0);
    },
    [],
  );
  const image = (second: boolean) => (
    <span className="pf-foldout-image" style={{ background: inside.colour }}>
      <span
        className="absolute"
        style={
          vertical
            ? {
                width: "100%",
                height: "200%",
                left: 0,
                top: second ? "-100%" : 0,
              }
            : {
                height: "100%",
                width: "200%",
                top: 0,
                left: second ? "-100%" : 0,
              }
        }
      >
        {progress > 0 && !sceneRendered && <NoteSurface side={inside} />}
      </span>
    </span>
  );
  const style = {
    left: `${item.x * 100}%`,
    top: `${item.y * 100}%`,
    width: `${item.width * 100}%`,
    height: `${item.height * 100}%`,
  };
  if (item.hinge === "none")
    return baked ? null : (
      <div className="pf-foldout" style={style}>
        <NoteSurface side={outside} label={item.title} />
      </div>
    );
  return (
    <div
      className="pf-foldout"
      data-foldout
      data-open={progress > 0.5}
      data-revealed={progress > 0}
      data-baked={baked}
      data-hinge={item.hinge}
      style={{ ...style, touchAction: "none" }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        cancelAnimationFrame(frame.current);
        const rect = e.currentTarget.getBoundingClientRect();
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          start: current.current,
          size: vertical ? rect.height : rect.width,
          moved: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        e.stopPropagation();
        const delta = vertical ? e.clientY - d.y : e.clientX - d.x;
        if (Math.abs(delta) > 4) d.moved = true;
        if (d.moved)
          update(
            Math.max(
              0,
              Math.min(
                1,
                d.start + (delta * (negative ? -1 : 1)) / (d.size * 1.5),
              ),
            ),
          );
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const d = drag.current;
        drag.current = null;
        if (d?.moved) {
          suppressClick.current = true;
          settle(current.current >= 0.5 ? 1 : 0);
        }
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
        settle(current.current >= 0.5 ? 1 : 0);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        settle(current.current > 0.5 ? 0 : 1);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          settle(0);
        }
      }}
    >
      <div
        className="pf-foldout-base"
        style={{ opacity: sceneRendered ? 0 : 1 }}
      >
        {image(negative)}
      </div>
      <button
        type="button"
        className="pf-foldout-flap"
        aria-expanded={progress > 0.5}
        aria-label={`${progress > 0.5 ? "Close" : "Open"} note: ${item.title}`}
        title="Click or drag to open and close"
        style={{
          transition: "none",
          transformOrigin: item.hinge,
          transform: `rotate${vertical ? "X" : "Y"}(${progress * 180 * (negative ? -1 : 1)}deg)`,
        }}
      >
        <span
          className="pf-foldout-front"
          style={{ opacity: sceneRendered ? 0 : 1 }}
        >
          {!sceneRendered && <NoteSurface side={outside} />}
        </span>
        <span
          className="pf-foldout-back"
          style={{
            opacity: sceneRendered ? 0 : 1,
            transform: vertical ? "rotateX(180deg)" : "rotateY(180deg)",
          }}
        >
          {image(!negative)}
        </span>
      </button>
      <span className="sr-only">
        {progress > 0.5 ? inside.text : outside.text}
      </span>
    </div>
  );
}
