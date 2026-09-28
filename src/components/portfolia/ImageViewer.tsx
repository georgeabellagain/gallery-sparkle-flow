import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { AssetImage } from "./AssetImage";
import { hasDetails, type ImageDetails } from "@/lib/portfolia/types";
import { Button } from "@/components/ui/button";

export interface ViewerTarget {
  assetId?: string;
  alt?: string;
  details?: ImageDetails;
  crop?: { x: number; y: number; w: number; h: number };
}

/**
 * A single-image viewer. Deliberately has no next/previous, no thumbnails and
 * no swipe-to-next: closing returns the visitor to exactly where they were.
 */
export function ImageViewer({
  target,
  onClose,
}: {
  target: ViewerTarget | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);
  const titleId = useId();
  const open = Boolean(target);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const t = setTimeout(() => closeRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      const el = restoreRef.current;
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    };
  }, [open]);

  const zoom = useCallback((delta: number) => {
    setScale((s) => {
      const next = Math.min(6, Math.max(1, Number((s + delta).toFixed(2))));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "+" || e.key === "=") zoom(0.5);
      else if (e.key === "-") zoom(-0.5);
      else if (e.key === "0") {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, zoom]);

  if (!target) return null;

  const details = target.details;
  const showDetails = hasDetails(details);

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <p id={titleId} className="truncate text-sm font-medium">
          {details?.title || "Image"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="quiet"
            size="icon-sm"
            onClick={() => zoom(-0.5)}
            disabled={scale <= 1}
            aria-label="Zoom out"
          >
            <Minus />
          </Button>
          <span className="w-10 text-center text-xxs tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="quiet" size="icon-sm" onClick={() => zoom(0.5)} aria-label="Zoom in">
            <Plus />
          </Button>
          <Button
            variant="quiet"
            size="icon-sm"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            disabled={scale === 1 && offset.x === 0 && offset.y === 0}
            aria-label="Reset zoom"
          >
            <RotateCcw />
          </Button>
          <Button
            ref={closeRef}
            variant="line"
            size="xs"
            onClick={onClose}
            className="ml-2"
            aria-label="Close image (Escape)"
          >
            <X /> Close
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-canvas"
          style={{ cursor: scale > 1 ? (drag.current ? "grabbing" : "grab") : "default" }}
          onWheel={(e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            zoom(e.deltaY > 0 ? -0.25 : 0.25);
          }}
          onDoubleClick={() => (scale > 1 ? (setScale(1), setOffset({ x: 0, y: 0 })) : zoom(1))}
          onPointerDown={(e) => {
            if (scale <= 1) return;
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset({
              x: drag.current.ox + (e.clientX - drag.current.x),
              y: drag.current.oy + (e.clientY - drag.current.y),
            });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <div
            className="max-h-full max-w-full transition-transform duration-150"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          >
            <AssetImage
              assetId={target.assetId}
              alt={target.alt || details?.title || ""}
              crop={target.crop}
              fit="contain"
              eager
              className="max-h-[calc(100vh-7rem)] w-auto max-w-[92vw]"
            />
          </div>
        </div>

        {showDetails && (
          <aside className="w-full shrink-0 overflow-y-auto border-t border-border px-5 py-5 lg:w-80 lg:border-l lg:border-t-0">
            {details?.title && <h2 className="text-base font-medium">{details.title}</h2>}
            {details?.description && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {details.description}
              </p>
            )}
            <dl className="mt-5 space-y-2.5 text-sm">
              <Row label="Date" value={details?.date} />
              <Row label="Medium" value={details?.medium} />
              <Row label="Dimensions" value={details?.dimensions} />
              <Row label="Credits" value={details?.credits} />
              {details?.custom
                ?.filter((c) => c.label && c.value)
                .map((c) => <Row key={c.id} label={c.label} value={c.value} />)}
            </dl>
            {details?.links?.some((l) => l.url) && (
              <div className="mt-6 flex flex-col items-start gap-2">
                {details.links
                  .filter((l) => l.url)
                  .map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex h-9 items-center rounded-md border border-border-strong px-4 text-sm hover:bg-accent"
                    >
                      {l.label || "Open link"}
                    </a>
                  ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
      <dt className="label-xs pt-0.5">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
