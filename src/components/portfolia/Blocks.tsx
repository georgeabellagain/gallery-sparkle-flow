import { AssetImage } from "./AssetImage";
import type { ViewerTarget } from "./ImageViewer";
import { useAssets } from "@/lib/portfolia/store";
import type { Hotspot, Item, LayoutSettings, PageElement, Theme } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

export interface BlockContext {
  theme: Theme;
  settings: LayoutSettings;
  onOpen: (target: ViewerTarget) => void;
  /** Editor affordances are off in the visitor view. */
  editing?: boolean;
}

export function textStyleToCss(style: Item extends never ? never : PageElement["style"], theme: Theme) {
  return {
    fontFamily: style?.font || theme.bodyFont,
    fontSize: `${(style?.size ?? 16) * theme.bodyScale}px`,
    fontWeight: style?.weight ?? 400,
    fontStyle: style?.italic ? "italic" : "normal",
    textAlign: style?.align ?? "left",
    color: style?.color || theme.text,
    lineHeight: style?.lineHeight ?? theme.lineHeight,
    letterSpacing: `${style?.letterSpacing ?? theme.letterSpacing}em`,
    whiteSpace: "pre-wrap" as const,
  };
}

/** Clickable regions are stored as 0-1 rectangles, so they stay aligned. */
function Hotspots({
  hotspots,
  ctx,
  fallback,
}: {
  hotspots?: Hotspot[];
  ctx: BlockContext;
  fallback: ViewerTarget;
}) {
  if (!hotspots?.length) return null;
  return (
    <>
      {hotspots.map((h) =>
        h.action === "link" && h.href ? (
          <a
            key={h.id}
            href={h.href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={h.label || "Open link"}
            className="absolute rounded-sm ring-transparent transition hover:ring-2 hover:ring-foreground/40 focus-visible:ring-2"
            style={{
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: `${h.w * 100}%`,
              height: `${h.h * 100}%`,
            }}
          />
        ) : (
          <button
            key={h.id}
            type="button"
            aria-label={h.label || h.details?.title || "Open image"}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onOpen({
                assetId: h.assetId ?? fallback.assetId,
                alt: h.label || fallback.alt,
                details: h.details,
                crop: h.assetId ? undefined : { x: h.x, y: h.y, w: h.w, h: h.h },
              });
            }}
            className="absolute rounded-sm ring-transparent transition hover:ring-2 hover:ring-foreground/40 focus-visible:ring-2"
            style={{
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: `${h.w * 100}%`,
              height: `${h.h * 100}%`,
            }}
          />
        ),
      )}
    </>
  );
}

export function PageBlock({
  item,
  ctx,
  className,
}: {
  item: Extract<Item, { kind: "pdfPage" | "composition" }>;
  ctx: BlockContext;
  className?: string;
}) {
  const assets = useAssets();
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        aspectRatio: String(item.aspect || 0.75),
        background: item.background || (item.kind === "pdfPage" ? "#ffffff" : "transparent"),
        opacity: item.opacity ?? 1,
      }}
    >
      {item.assetId && (
        <AssetImage
          assetId={item.assetId}
          alt={item.kind === "pdfPage" ? `Imported page ${item.pageNumber ?? ""}` : ""}
          fit="contain"
          className="absolute inset-0 h-full w-full"
        />
      )}
      {item.elements
        .filter((el) => !el.hidden)
        .slice()
        .sort((a, b) => a.z - b.z)
        .map((el) => (
          <div
            key={el.id}
            className="absolute"
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.w}%`,
              height: `${el.h}%`,
              transform: `rotate(${el.rotation}deg)`,
              opacity: el.opacity,
              zIndex: el.z,
            }}
          >
            {el.kind === "image" ? (
              el.href ? (
                <a href={el.href} target="_blank" rel="noreferrer noopener" className="block h-full w-full">
                  <AssetImage assetId={el.assetId} alt={el.alt || ""} crop={el.crop} focal={el.focal} className="h-full w-full" />
                </a>
              ) : (
                <button
                  type="button"
                  className="block h-full w-full cursor-zoom-in"
                  onClick={() =>
                    ctx.onOpen({
                      assetId: el.assetId,
                      alt: el.alt,
                      details: el.details,
                      crop: el.crop,
                    })
                  }
                  aria-label={el.details?.title ? `Open ${el.details.title}` : "Open image"}
                >
                  <AssetImage assetId={el.assetId} alt={el.alt || ""} crop={el.crop} focal={el.focal} className="h-full w-full" />
                </button>
              )
            ) : (
              <p style={textStyleToCss(el.style, ctx.theme)}>{el.text}</p>
            )}
          </div>
        ))}
      <Hotspots
        hotspots={item.hotspots}
        ctx={ctx}
        fallback={{
          assetId: item.assetId,
          alt: item.assetId ? assets[item.assetId]?.name : undefined,
        }}
      />
    </div>
  );
}

export function ImageBlock({
  item,
  ctx,
  fit = "contain",
  className,
}: {
  item: Extract<Item, { kind: "image" }>;
  ctx: BlockContext;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const caption = ctx.settings.captions ? item.details?.title : undefined;
  return (
    <figure className={cn("relative", className)} style={{ opacity: item.opacity ?? 1 }}>
      <div className="relative">
        <button
          type="button"
          className={cn("block w-full cursor-zoom-in", fit === "cover" && "h-full")}
          onClick={() => ctx.onOpen({ assetId: item.assetId, alt: item.alt, details: item.details, crop: item.crop })}
          aria-label={item.details?.title ? `Open ${item.details.title}` : "Open image"}
        >
          <AssetImage
            assetId={item.assetId}
            alt={item.alt || ""}
            crop={item.crop}
            focal={item.focal}
            fit={fit}
            className={cn("w-full", fit === "cover" ? "h-full" : "h-auto")}
          />
        </button>
        <Hotspots hotspots={item.hotspots} ctx={ctx} fallback={{ assetId: item.assetId, alt: item.alt }} />
      </div>
      {caption && (
        <figcaption
          className="mt-2 text-xs"
          style={{ fontFamily: ctx.theme.bodyFont, color: ctx.theme.text, opacity: 0.6 }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function TextBlock({
  item,
  ctx,
  className,
}: {
  item: Extract<Item, { kind: "text" }>;
  ctx: BlockContext;
  className?: string;
}) {
  return (
    <p className={className} style={{ ...textStyleToCss(item.style, ctx.theme), opacity: item.opacity ?? 1 }}>
      {item.text}
    </p>
  );
}

/** One item, rendered for flowing layouts (scroll / paged / book). */
export function ItemBlock({ item, ctx }: { item: Item; ctx: BlockContext }) {
  if (item.hidden) return null;
  if (item.kind === "text") return <TextBlock item={item} ctx={ctx} />;
  if (item.kind === "image") return <ImageBlock item={item} ctx={ctx} />;
  return <PageBlock item={item} ctx={ctx} className="hairline" />;
}

/** One item, rendered as a tile. Compositions stay intact as a single tile. */
export function TileBlock({
  item,
  ctx,
  square,
}: {
  item: Item;
  ctx: BlockContext;
  square?: boolean;
}) {
  if (item.hidden) return null;
  if (item.kind === "text") {
    return (
      <div
        className={cn("flex items-center justify-center p-5 hairline", square && "aspect-square")}
        style={{ background: ctx.theme.background }}
      >
        <TextBlock item={item} ctx={ctx} className="text-center" />
      </div>
    );
  }
  if (item.kind === "image") {
    return square ? (
      <div className="aspect-square overflow-hidden">
        <ImageBlock item={item} ctx={ctx} fit="cover" className="h-full" />
      </div>
    ) : (
      <ImageBlock item={item} ctx={ctx} fit="contain" />
    );
  }
  // A designed page keeps its own composition; it is never dismantled.
  return square ? (
    <div className="flex aspect-square items-center justify-center overflow-hidden bg-canvas hairline">
      <div className="w-full" style={{ maxHeight: "100%" }}>
        <PageBlock item={item} ctx={ctx} />
      </div>
    </div>
  ) : (
    <PageBlock item={item} ctx={ctx} className="hairline" />
  );
}
