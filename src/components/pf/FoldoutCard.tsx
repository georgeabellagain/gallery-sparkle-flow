import { useEffect, useRef, useState } from "react";
import {
  foldoutSurfaces,
  type Foldout,
  type FoldoutSurface,
} from "@/lib/portfolia/foldouts";
import {
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
  }, [side.colour, side.text, side.imageKey]);
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
export function StoredFoldout({
  item,
  baked = false,
}: {
  item: Foldout;
  baked?: boolean;
}) {
  return <FoldoutCard item={item} baked={baked} />;
}
export function FoldoutCard({
  item,
  baked = false,
}: {
  item: Foldout;
  baked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { outside, inside } = foldoutSurfaces(item);
  const close = () => {
    setOpen(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRevealed(false), 560);
  };
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setRevealed(true);
    requestAnimationFrame(() => setOpen(true));
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const image = (right: boolean) => (
    <span className="pf-foldout-image" style={{ background: inside.colour }}>
      <span
        className="absolute inset-y-0 w-[200%]"
        style={{ left: right ? "-100%" : 0 }}
      >
        {revealed && <NoteSurface side={inside} />}
      </span>
    </span>
  );
  return (
    <div
      className="pf-foldout"
      data-foldout
      data-open={open}
      data-revealed={revealed}
      data-baked={baked}
      data-hinge={item.hinge}
      style={{
        left: `${item.x * 100}%`,
        top: `${item.y * 100}%`,
        width: `${item.width * 100}%`,
        height: `${item.height * 100}%`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="pf-foldout-base">{image(item.hinge === "left")}</div>
      <button
        type="button"
        className="pf-foldout-flap"
        aria-expanded={open}
        aria-label={`${open ? "Close" : "Open"} fold-out: ${item.title}`}
        title={`${open ? "Close" : "Open"} ${item.title}`}
        onClick={toggle}
      >
        <span className="pf-foldout-front">
          <NoteSurface side={outside} />
        </span>
        <span className="pf-foldout-back">{image(item.hinge !== "left")}</span>
      </button>
      {open && (
        <button
          type="button"
          className="pf-foldout-close"
          aria-label={`Close fold-out: ${item.title}`}
          onClick={close}
        >
          ×
        </button>
      )}
      <span className="sr-only">
        {open ? inside.text || `Revealed image: ${item.title}` : outside.text}
      </span>
    </div>
  );
}
