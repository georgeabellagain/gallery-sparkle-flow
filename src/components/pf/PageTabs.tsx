import { noteInk } from "@/lib/portfolia/foldout-paint";
import type { PageTag } from "@/lib/portfolia/page-extras";
import type { PageBounds } from "@/lib/portfolia/foldouts";

import { tabEdge, type TabEdge } from "@/lib/portfolia/page-extras";
export { tabEdge };

/** Coloured index tabs along the edges of the book. They show on a closed book and jump to their page when pressed. */
export function PageTabs({
  tags,
  edgeBounds,
  viewportWidth,
  onGo,
  disabled,
}: {
  tags: Array<PageTag & { edge: TabEdge; current: boolean }>;
  /** The left and right edge of the book on screen, in % of the viewport, and where the pages begin and end vertically. */
  edgeBounds: { left: number; right: number; top: number; height: number };
  viewportWidth: number;
  onGo: (page: number) => void;
  disabled?: boolean;
}) {
  const sides: TabEdge[] = ["left", "right"];
  const room = (edge: TabEdge) => (edge === "left" ? edgeBounds.left : 100 - edgeBounds.right) * viewportWidth / 100;
  return (
    <>
      {sides.map((edge) => {
        const group = tags.filter((t) => t.edge === edge);
        if (!group.length) return null;
        const gap = 1.2;
        const each = Math.min(15, (edgeBounds.height - gap * (group.length + 1)) / group.length);
        // With little room beside the book (a phone) the tab overlaps the page edge instead of sticking out of it.
        const out = Math.min(26, Math.max(0, room(edge) - 4));
        const overlap = out >= 18 ? 4 : 22;
        const width = out >= 18 ? out + overlap : overlap;
        return group.map((tag, i) => {
          const top = edgeBounds.top + gap + i * (each + gap);
          const ink = noteInk(tag.colour);
          const x = edge === "right" ? edgeBounds.right : edgeBounds.left;
          return (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              aria-label={`Go to page ${tag.page}${tag.label ? `: ${tag.label}` : ""}`}
              aria-current={tag.current ? "page" : undefined}
              title={tag.label ? `${tag.label} · page ${tag.page}` : `Page ${tag.page}`}
              data-page-tab
              className="pf-page-tab absolute z-30 flex items-center justify-center text-[11px] font-medium leading-none shadow-[0_2px_6px_rgba(0,0,0,.28)] transition-transform duration-200 hover:scale-x-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default"
              style={{
                top: `${top}%`,
                height: `${each}%`,
                width,
                background: tag.colour,
                color: ink,
                ...(edge === "right"
                  ? { left: `calc(${x}% - ${overlap}px)`, borderRadius: "0 8px 8px 0", transformOrigin: "left center" }
                  : { left: `calc(${x}% - ${width - overlap}px)`, borderRadius: "8px 0 0 8px", transformOrigin: "right center" }),
                ...(tag.current ? { filter: "brightness(1.08)" } : null),
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onGo(tag.page);
              }}
            >
              <span
                className="max-h-full overflow-hidden whitespace-nowrap px-0.5"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: edge === "left" ? "rotate(180deg)" : undefined }}
              >
                {tag.label || tag.page}
              </span>
            </button>
          );
        });
      })}
    </>
  );
}
export type { PageBounds };
