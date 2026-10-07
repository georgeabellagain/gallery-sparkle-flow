import type { PageTag } from "@/lib/portfolia/page-extras";

/**
 * The tabs themselves are paper in the book (see book-tabs.ts), lit and turned with their pages. These are the
 * invisible buttons laid exactly over them, so a tab can be pressed, tabbed to and read aloud.
 */
export function PageTabButtons({
  rects,
  tags,
  current,
  disabled,
  onGo,
}: {
  rects: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  tags: Map<string, PageTag>;
  current: Set<string>;
  disabled?: boolean;
  onGo: (page: number) => void;
}) {
  return (
    <>
      {rects.map((r) => {
        const tag = tags.get(r.id);
        if (!tag) return null;
        const name = tag.label ? `${tag.label} · page ${tag.page}` : `Page ${tag.page}`;
        return (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            aria-label={`Go to ${name.toLowerCase()}`}
            aria-current={current.has(r.id) ? "page" : undefined}
            title={name}
            data-page-tab
            className="absolute z-30 cursor-pointer rounded-sm bg-transparent p-0 outline-offset-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 disabled:cursor-default"
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.width}%`, height: `${r.height}%` }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onGo(tag.page);
            }}
          />
        );
      })}
    </>
  );
}
