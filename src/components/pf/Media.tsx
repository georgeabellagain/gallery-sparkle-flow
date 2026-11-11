import { useEffect, useRef, useState } from "react";
import { marketingAsset } from "@/lib/portfolia/marketing-assets";

/** A marketing picture from public/marketing/. Renders nothing until the asset is listed in the manifest. */
export function MarketingImage({ name, className, sizes = "(min-width: 1024px) 600px, 100vw", priority = false }: { name: string; className?: string; sizes?: string; priority?: boolean }) {
  const asset = marketingAsset(name);
  if (!asset || asset.kind !== "image") return null;
  return <img
    src={`/marketing/${name}-1600.webp`}
    srcSet={`/marketing/${name}-800.webp 800w, /marketing/${name}-1600.webp 1600w`}
    sizes={sizes}
    width={asset.width}
    height={asset.height}
    alt={asset.alt}
    loading={priority ? "eager" : "lazy"}
    decoding="async"
    className={className}
  />;
}

/**
 * A short muted loop (design standard, Motion). It loads nothing until it nears the screen, plays only while visible,
 * and with reduced motion shows its poster only.
 */
export function LoopClip({ src, poster, width, height, alt, className }: { src: string; poster: string; width: number; height: number; alt: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => { setReduced(Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)); }, []);
  useEffect(() => {
    const el = video.current;
    if (!el || reduced || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setNear(true); void el.play().catch(() => {}); } else el.pause();
    }, { rootMargin: "300px" });
    // Start watching once the page has settled: while the hero is still sizing itself, clips far down the page
    // briefly sit near the top and would load early.
    let idle: number | undefined;
    const timer = setTimeout(() => {
      if (window.requestIdleCallback) idle = window.requestIdleCallback(() => observer.observe(el), { timeout: 2000 });
      else observer.observe(el);
    }, 500);
    return () => { clearTimeout(timer); if (idle !== undefined) window.cancelIdleCallback(idle); observer.disconnect(); };
  }, [reduced]);
  // Once the source is attached the browser needs a nudge to start.
  useEffect(() => { if (near) void video.current?.play().catch(() => {}); }, [near]);
  if (reduced) return <img src={poster} width={width} height={height} alt={alt} loading="lazy" className={className} />;
  // The poster too waits until the clip nears the screen, so nothing below the first screen loads early.
  return <video ref={video} muted loop playsInline preload="none" width={width} height={height} poster={near ? poster : undefined} aria-label={alt} className={className}>
    {near && <source src={src} type="video/mp4" />}
  </video>;
}

/** A clip from public/marketing/. Renders nothing until the asset is listed in the manifest. */
export function MarketingClip({ name, className }: { name: string; className?: string }) {
  const asset = marketingAsset(name);
  if (!asset || asset.kind !== "clip") return null;
  return <LoopClip src={`/marketing/${name}.mp4`} poster={`/marketing/${name}-poster.webp`} width={asset.width} height={asset.height} alt={asset.alt} className={className} />;
}

/** The feature clips already shipped in public/features/ (1600 × 1000 posters). */
export function FeatureClip({ name, alt, className }: { name: "lighting" | "share" | "links" | "paged" | "scroll" | "background" | "tabs"; alt: string; className?: string }) {
  return <LoopClip src={`/features/${name}.mp4`} poster={`/features/${name}-poster.webp`} width={1600} height={1000} alt={alt} className={className} />;
}
