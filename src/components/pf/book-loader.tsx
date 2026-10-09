import type { CSSProperties } from "react";
import type { Tone } from "@/components/pf/viewer-ui";

/**
 * A compact outline book with one turning page. Remains still for reduced motion.
 */
export function BookLoader({ tone, label = "Preparing your portfolio…", detail }: { tone: Tone; label?: string; detail?: string }) {
  const ink = tone === "dark" ? "255,255,255" : "28,27,26";
  return (
    <div role="status" aria-live="polite" aria-label={label || "Loading portfolio"} className="flex flex-col items-center gap-4" style={{ "--pf-ink": ink } as CSSProperties}>
      <style>{`
        .pf-load-book { position: relative; width: 28px; height: 20px; perspective: 140px; }
        .pf-load-outline { position: absolute; inset: 0; border: 1px solid rgba(var(--pf-ink), 0.5); border-radius: 2px; }
        .pf-load-outline::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px solid rgba(var(--pf-ink), 0.5); }
        .pf-load-leaf { position: absolute; top: 0; left: 50%; width: 50%; height: 100%; box-sizing: border-box; border: 1px solid rgba(var(--pf-ink), 0.9); border-radius: 0 2px 2px 0; transform-origin: left center; animation: pf-load-turn 2s cubic-bezier(0.45, 0, 0.25, 1) infinite; }
        @keyframes pf-load-turn {
          0%, 12% { transform: rotateY(0deg); opacity: 1; }
          68%, 84% { transform: rotateY(-180deg); opacity: 1; }
          92% { transform: rotateY(-180deg); opacity: 0; }
          93% { transform: rotateY(0deg); opacity: 0; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .pf-load-leaf { animation: none; } }
      `}</style>
      <div className="pf-load-book" aria-hidden>
        <span className="pf-load-outline" />
        <span className="pf-load-leaf" />
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
