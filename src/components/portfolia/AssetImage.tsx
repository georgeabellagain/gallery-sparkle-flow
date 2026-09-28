import { useEffect, useState } from "react";
import { cachedAssetUrl, resolveAssetUrl } from "@/lib/portfolia/assets";
import type { AssetMeta } from "@/lib/portfolia/types";
import { useAssets } from "@/lib/portfolia/store";
import { cn } from "@/lib/utils";

export function useAssetUrl(assetId?: string): { url?: string; meta?: AssetMeta } {
  const assets = useAssets();
  const meta = assetId ? assets[assetId] : undefined;
  const [url, setUrl] = useState<string | undefined>(() => cachedAssetUrl(meta));

  useEffect(() => {
    let live = true;
    if (!meta) {
      setUrl(undefined);
      return;
    }
    const result = resolveAssetUrl(meta);
    if (typeof result === "string") setUrl(result);
    else if (result) {
      void result.then((u) => {
        if (live) setUrl(u);
      });
    } else setUrl(undefined);
    return () => {
      live = false;
    };
  }, [meta]);

  return { url, meta };
}

interface AssetImageProps {
  assetId?: string;
  alt?: string;
  className?: string;
  /** object-fit behaviour; "contain" preserves proportions inside the box. */
  fit?: "cover" | "contain";
  focal?: { x: number; y: number };
  crop?: { x: number; y: number; w: number; h: number };
  eager?: boolean;
  draggable?: boolean;
}

/**
 * Renders an asset. Crops are applied as a CSS transform so the original
 * bytes are never modified.
 */
export function AssetImage({
  assetId,
  alt = "",
  className,
  fit = "cover",
  focal,
  crop,
  eager,
  draggable = false,
}: AssetImageProps) {
  const { url, meta } = useAssetUrl(assetId);

  if (!url) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-xxs text-muted-foreground", className)}
        aria-hidden={alt ? undefined : true}
      >
        {meta ? "Loading…" : "Image unavailable in this browser"}
      </div>
    );
  }

  if (crop) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img
          src={url}
          alt={alt}
          draggable={draggable}
          loading={eager ? "eager" : "lazy"}
          className="absolute origin-top-left"
          style={{
            width: `${100 / crop.w}%`,
            height: `${100 / crop.h}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
            objectFit: "cover",
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      draggable={draggable}
      loading={eager ? "eager" : "lazy"}
      width={meta?.width}
      height={meta?.height}
      className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
      style={focal ? { objectPosition: `${focal.x}% ${focal.y}%` } : undefined}
    />
  );
}
