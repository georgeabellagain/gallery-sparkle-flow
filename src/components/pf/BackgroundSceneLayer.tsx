import type { CSSProperties } from "react";
import type { BackgroundScene } from "@/lib/portfolia/background-scenes";
import { cn } from "@/lib/utils";

/**
 * Draws a colour-and-motion background: soft blobs of colour on a base, each a radial gradient that only moves
 * (transform), so the browser composites it smoothly without repainting. Still for reduced motion.
 */
export function BackgroundSceneLayer({ scene, className, animate = true }: { scene: BackgroundScene; className?: string; animate?: boolean }) {
  return (
    <div aria-hidden className={cn("pf-scene absolute inset-0 overflow-hidden", className)} style={{ background: scene.base }}>
      {/* Motion rules live in styles.css (.pf-scene-*). */}
      <div className={cn("absolute inset-0", (!scene.animated || !animate) && "pf-scene-still")}>
        {scene.blobs.map((b, i) => {
          // Sized to the container (so small previews match the full view); drift is a share of the blob's own size.
          const style = {
            left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.size * 140}%`, aspectRatio: "1",
            background: `radial-gradient(circle at center, ${b.colour} 0%, ${b.colour}cc 22%, ${b.colour}00 68%)`,
            transform: "translate3d(-50%, -50%, 0)",
            "--pf-dx": `${((b.drift?.[0] ?? 0) / (b.size * 1.4)) * 100}%`, "--pf-dy": `${((b.drift?.[1] ?? 0) / (b.size * 1.4)) * 100}%`, "--pf-period": `${b.period ?? 30}s`,
            animationDelay: `${-(i * 7)}s`,
          } as CSSProperties;
          return <span key={i} className="pf-scene-blob" style={style} />;
        })}
        {animate && scene.animated && scene.sweep && <span className="pf-scene-sweep" style={{ background: `linear-gradient(100deg, transparent 35%, ${scene.sweep} 50%, transparent 65%)` }} />}
      </div>
    </div>
  );
}
