import type { CSSProperties } from "react";
import type { Tone } from "@/components/pf/viewer-ui";

const LEAVES = [0, 1, 2];

/**
 * A small page-turning book, shown while a portfolio is being prepared. It is a quiet,
 * simplified version of the animation on the home page. Still, if motion is reduced.
 */
export function BookLoader({ tone, label = "Preparing your portfolio…", detail }: { tone: Tone; label?: string; detail?: string }) {
  const ink = tone === "dark" ? "255,255,255" : "28,27,26";
  return (
    <div role="status" aria-live="polite" aria-label={label || "Loading portfolio"} className="flex flex-col items-center gap-4" style={{ "--pf-ink": ink } as CSSProperties}>
      <style>{`
        .pf-load-book { position: relative; width: 72px; height: 50px; perspective: 420px; }
        .pf-load-page, .pf-load-face { position: absolute; top: 0; width: 36px; height: 50px; box-sizing: border-box; border: 1.5px solid rgba(var(--pf-ink), 0.7); background: rgba(var(--pf-ink), 0.1); }
        .pf-load-page:first-child { left: 0; border-radius: 3px 0 0 3px; border-right-width: 0; }
        .pf-load-page:nth-child(2) { left: 36px; border-radius: 0 3px 3px 0; }
        .pf-load-leaf { position: absolute; top: 0; left: 36px; width: 36px; height: 50px; transform-origin: 0 50%; transform-style: preserve-3d; animation: pf-load-turn 2.4s ease-in-out infinite; }
        .pf-load-face { left: 0; border-radius: 0 3px 3px 0; backface-visibility: hidden; background: rgba(var(--pf-ink), 0.22); }
        .pf-load-back { transform: rotateY(180deg); border-radius: 3px 0 0 3px; }
        @keyframes pf-load-turn {
          0% { transform: rotateY(0deg); opacity: 1; }
          42% { transform: rotateY(-180deg); opacity: 1; }
          78% { transform: rotateY(-180deg); opacity: 1; }
          90% { transform: rotateY(-180deg); opacity: 0; }
          91% { transform: rotateY(0deg); opacity: 0; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .pf-load-leaf { animation: none; } }
      `}</style>
      <div className="pf-load-book" aria-hidden>
        <span className="pf-load-page" />
        <span className="pf-load-page" />
        {LEAVES.map((i) => (
          <span key={i} className="pf-load-leaf" style={{ animationDelay: `${i * 0.22}s` }}>
            <span className="pf-load-face" />
            <span className="pf-load-face pf-load-back" />
          </span>
        ))}
      </div>
      {label ? (
        <p className="text-xs" style={{ color: `rgba(${ink}, 0.7)` }}>
          {label}
          {detail ? <span className="ml-1 tabular-nums opacity-70">{detail}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
