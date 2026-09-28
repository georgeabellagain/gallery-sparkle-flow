import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ItemBlock, TileBlock, type BlockContext } from "./Blocks";
import type { Item, LayoutId } from "@/lib/portfolia/types";
import { useReducedMotion } from "@/lib/portfolia/useReducedMotion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewProps {
  items: Item[];
  ctx: BlockContext;
  /** Narrow rendering for the mobile preview frame. */
  compact?: boolean;
}

export function Presentation({
  layout,
  items,
  ctx,
  compact,
}: ViewProps & { layout: LayoutId }) {
  const visible = useMemo(() => items.filter((i) => !i.hidden), [items]);

  if (!visible.length) {
    return (
      <div className="flex min-h-64 items-center justify-center px-6 py-20 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }

  switch (layout) {
    case "paged":
      return <PagedView items={visible} ctx={ctx} compact={compact} />;
    case "grid":
      return <GridView items={visible} ctx={ctx} compact={compact} />;
    case "masonry":
      return <MasonryView items={visible} ctx={ctx} compact={compact} />;
    case "book":
      return <BookView items={visible} ctx={ctx} compact={compact} />;
    case "scroll":
    default:
      return <ScrollView items={visible} ctx={ctx} compact={compact} />;
  }
}

function frame(ctx: BlockContext, compact?: boolean) {
  return {
    maxWidth: compact ? "100%" : `${ctx.settings.maxWidth}px`,
    paddingLeft: `${compact ? Math.min(ctx.settings.padding, 16) : ctx.settings.padding}px`,
    paddingRight: `${compact ? Math.min(ctx.settings.padding, 16) : ctx.settings.padding}px`,
  };
}

/* ------------------------------------------------- 1. Paged presentation --- */

function PagedView({ items, ctx, compact }: ViewProps) {
  const [index, setIndex] = useState(0);
  const total = items.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))),
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const item = items[Math.min(index, total - 1)]!;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full flex-1 py-10" style={frame(ctx, compact)}>
        <div key={item.id} className="soft-in">
          <ItemBlock item={item} ctx={ctx} />
        </div>
      </div>
      <div className="sticky bottom-0 mt-auto flex items-center justify-center gap-4 border-t border-border bg-background/92 px-4 py-2.5 backdrop-blur">
        <Button variant="quiet" size="icon-sm" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <p className="text-xxs tabular-nums text-muted-foreground" aria-live="polite">
          {index + 1} / {total}
        </p>
        <Button
          variant="quiet"
          size="icon-sm"
          onClick={() => go(1)}
          disabled={index === total - 1}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
        <span className="hidden text-xxs text-muted-foreground sm:inline">Use ← and → keys</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------- 2. Continuous scroll ------- */

const PAGE_SIZE = 6;

function ScrollView({ items, ctx, compact }: ViewProps) {
  const [count, setCount] = useState(Math.min(items.length, PAGE_SIZE));
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCount((c) => Math.min(items.length, Math.max(c, PAGE_SIZE)));
  }, [items.length]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= items.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(items.length, c + PAGE_SIZE));
        }
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [count, items.length]);

  return (
    <div className="mx-auto w-full py-12" style={frame(ctx, compact)}>
      <div className="flex flex-col" style={{ gap: `${compact ? Math.min(ctx.settings.gap, 48) : ctx.settings.gap}px` }}>
        {items.slice(0, count).map((item) => (
          <ItemBlock key={item.id} item={item} ctx={ctx} />
        ))}
      </div>
      {count < items.length && (
        <div ref={sentinel} className="py-10 text-center text-xxs text-muted-foreground">
          Loading more work…
        </div>
      )}
      {count >= items.length && <div className="h-16" />}
    </div>
  );
}

/* ------------------------------------------------------- 3. Grid ---------- */

function GridView({ items, ctx, compact }: ViewProps) {
  const cols = compact ? Math.min(2, ctx.settings.columns) : ctx.settings.columns;
  return (
    <div className="mx-auto w-full py-10" style={frame(ctx, compact)}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: `${ctx.settings.gap}px`,
        }}
      >
        {items.map((item) => (
          <TileBlock key={item.id} item={item} ctx={ctx} square />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- 4. Masonry ---------- */

function MasonryView({ items, ctx, compact }: ViewProps) {
  const cols = compact ? Math.min(2, ctx.settings.columns) : ctx.settings.columns;
  return (
    <div className="mx-auto w-full py-10" style={frame(ctx, compact)}>
      <div
        style={{
          columnCount: cols,
          columnGap: `${ctx.settings.gap}px`,
        }}
      >
        {items.map((item) => (
          <div key={item.id} style={{ breakInside: "avoid", marginBottom: `${ctx.settings.gap}px` }}>
            <TileBlock item={item} ctx={ctx} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------- 5. Page-turn book ----- */

function BookView({ items, ctx, compact }: ViewProps) {
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [rot, setRot] = useState(0); // 0 .. -172
  const [dir, setDir] = useState<"f" | "b" | null>(null);
  const [animating, setAnimating] = useState(false);
  const dragRef = useRef<{ x: number; width: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const settle = useCallback(
    (complete: boolean, direction: "f" | "b") => {
      setAnimating(true);
      const target = direction === "f" ? (complete ? -172 : 0) : complete ? 0 : -172;
      setRot(target);
      window.setTimeout(
        () => {
          setAnimating(false);
          setDir(null);
          setRot(0);
          if (complete) setIndex((i) => Math.min(total - 1, Math.max(0, i + (direction === "f" ? 1 : -1))));
        },
        reduced ? 10 : 520,
      );
    },
    [reduced, total],
  );

  const turn = useCallback(
    (direction: "f" | "b") => {
      if (dir || animating) return;
      if (direction === "f" && index >= total - 1) return;
      if (direction === "b" && index <= 0) return;
      setDir(direction);
      setRot(direction === "f" ? 0 : -172);
      requestAnimationFrame(() => settle(true, direction));
    },
    [dir, animating, index, total, settle],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") turn("f");
      if (e.key === "ArrowLeft") turn("b");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const startDrag = (direction: "f" | "b") => (e: React.PointerEvent) => {
    if (animating) return;
    if (direction === "f" && index >= total - 1) return;
    if (direction === "b" && index <= 0) return;
    const width = boxRef.current?.getBoundingClientRect().width ?? 600;
    dragRef.current = { x: e.clientX, width };
    setDir(direction);
    setRot(direction === "f" ? 0 : -172);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !dir) return;
    const progress =
      dir === "f"
        ? Math.min(1, Math.max(0, (d.x - e.clientX) / (d.width * 0.85)))
        : 1 - Math.min(1, Math.max(0, (e.clientX - d.x) / (d.width * 0.85)));
    setRot(-172 * progress);
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d || !dir) return;
    dragRef.current = null;
    const progress = Math.abs(rot) / 172;
    settle(dir === "f" ? progress > 0.35 : progress < 0.65, dir);
  };

  const leafIndex = dir === "b" ? index - 1 : index;
  const underIndex = dir === "f" ? index + 1 : index;
  const current = items[Math.min(index, total - 1)]!;

  return (
    <div className="mx-auto flex w-full flex-col items-center py-8" style={frame(ctx, compact)}>
      <div
        ref={boxRef}
        className="book-scene relative w-full select-none"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Page beneath: either the next page (turning forward) or the current one. */}
        <div className="relative">
          <div className="hairline bg-background">
            <ItemBlock item={items[Math.min(Math.max(underIndex, 0), total - 1)]!} ctx={ctx} />
          </div>

          {dir && (
            <div
              className="book-leaf absolute inset-0 bg-background hairline"
              style={{
                transformOrigin: "left center",
                transform: reduced ? undefined : `rotateY(${rot}deg)`,
                opacity: reduced ? 1 - Math.abs(rot) / 172 : 1,
                transition: animating
                  ? reduced
                    ? "opacity 180ms linear"
                    : "transform 500ms cubic-bezier(.22,.61,.36,1)"
                  : undefined,
                boxShadow: `${Math.min(24, Math.abs(rot) / 5)}px 0 ${Math.min(40, Math.abs(rot) / 3)}px -12px oklch(0 0 0 / 0.18)`,
              }}
            >
              <ItemBlock item={items[Math.min(Math.max(leafIndex, 0), total - 1)]!} ctx={ctx} />
            </div>
          )}

          {!dir && (
            <div className="absolute inset-0 bg-background hairline">
              <ItemBlock item={current} ctx={ctx} />
            </div>
          )}

          {/* Corner grips. Buttons below do the same job for keyboard and touch. */}
          {index < total - 1 && !dir && (
            <div
              role="presentation"
              onPointerDown={startDrag("f")}
              title="Drag this corner to turn the page"
              className="absolute bottom-0 right-0 h-20 w-20 cursor-grab touch-none"
              style={{
                background:
                  "linear-gradient(315deg, oklch(0 0 0 / 0.1) 0%, oklch(0 0 0 / 0.04) 42%, transparent 46%)",
              }}
            />
          )}
          {index > 0 && !dir && (
            <div
              role="presentation"
              onPointerDown={startDrag("b")}
              title="Drag this corner to turn back"
              className="absolute bottom-0 left-0 h-20 w-20 cursor-grab touch-none"
              style={{
                background:
                  "linear-gradient(45deg, oklch(0 0 0 / 0.08) 0%, oklch(0 0 0 / 0.03) 42%, transparent 46%)",
              }}
            />
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button variant="line" size="xs" onClick={() => turn("b")} disabled={index === 0} aria-label="Previous page">
          <ChevronLeft /> Back
        </Button>
        <p className="text-xxs tabular-nums text-muted-foreground" aria-live="polite">
          {index + 1} / {total}
        </p>
        <Button
          variant="line"
          size="xs"
          onClick={() => turn("f")}
          disabled={index === total - 1}
          aria-label="Next page"
        >
          Next <ChevronRight />
        </Button>
      </div>
      <p className={cn("mt-2 text-xxs text-muted-foreground", compact && "hidden")}>
        Drag the bottom corner, use the buttons, or press ← / →.
      </p>
    </div>
  );
}
