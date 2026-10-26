import type { CSSProperties } from "react";
import type { Tone } from "@/components/pf/viewer-ui";

/** One turn and a short rest, repeated. */
const LOOP_S = 1.9;
/** A short rest before the first turn, so the loader appears as a settled, open book. */
const FIRST_TURN_S = 0.2;

/**
 * A small open book, tilted towards the reader, turning its page over and over. It is one book with one moving
 * page and a single animation: the page is part of the book's own 3D space, hinged on its spine, so nothing can drift
 * apart from it whenever the browser starts drawing. The page lies exactly like the pages beneath it at both ends of
 * its turn, so returning to the start is invisible. Only transform animates, so it stays smooth while the portfolio
 * is prepared. The book is flattened in depth (scaleZ), so the page rolls over close to the paper. Holds still for
 * reduced motion.
 */
export function BookLoader({ tone, label = "Preparing your portfolio…", detail }: { tone: Tone; label?: string; detail?: string }) {
  const ink = tone === "dark" ? "255,255,255" : "28,27,26";
  const paper = tone === "dark" ? "#f3efe6" : "#ffffff";
  return (
    <div role="status" aria-live="polite" aria-label={label || "Loading portfolio"} className="flex flex-col items-center gap-3" style={{ "--pf-paper": paper, "--pf-loop": `${LOOP_S}s`, "--pf-first": `${FIRST_TURN_S}s` } as CSSProperties}>
      <style>{`
        /* Drawn at 76 × 52 and shown at 70%, so every line and shadow keeps its proportions. */
        .pf-lb-frame { width: 53px; height: 36px; }
        .pf-lb { position: relative; width: 76px; height: 52px; perspective: 260px; perspective-origin: 50% 0%; transform: scale(.7); transform-origin: 0 0; }
        .pf-lb-book { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateX(38deg) rotateZ(-14deg) scaleZ(.5); }
        .pf-lb-book > * { position: absolute; box-sizing: border-box; }
        .pf-lb-floor { left: -10%; right: -10%; bottom: -28%; height: 40%; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.22), rgba(0,0,0,0)); transform: translateZ(-2px); }
        .pf-lb-block { inset: 0 -1px; border-radius: 2px; background: var(--pf-paper); transform: translateZ(-1.5px); box-shadow: 0 1.5px 0 0 #e6e1d6, 0 3px 0 0 #dcd6c9, 0 4.5px 7px -2px rgba(0,0,0,.28); }
        /* Text lines inside the margins, paper everywhere: two background layers with their own boxes. */
        .pf-lb-page, .pf-lb-leaf { top: 0; width: 50%; height: 100%; padding: 7px 6px; background: repeating-linear-gradient(to bottom, transparent 0 4px, rgba(28,27,26,.13) 4px 5px) content-box no-repeat, var(--pf-paper); }
        .pf-lb-page { box-shadow: 0 0 0 .5px rgba(0,0,0,.07); transform: translateZ(-1px); }
        /* Shaded towards the spine exactly like the turning page, so it matches them at both ends of its turn. */
        .pf-lb-left { left: 0; border-radius: 2px 0 0 2px; background: linear-gradient(to left, rgba(0,0,0,.10), rgba(0,0,0,0) 35%, rgba(255,255,255,.18) 70%, rgba(0,0,0,.04)), repeating-linear-gradient(to bottom, transparent 0 4px, rgba(28,27,26,.13) 4px 5px) content-box no-repeat, var(--pf-paper); }
        .pf-lb-right { left: 50%; border-radius: 0 2px 2px 0; background: linear-gradient(to right, rgba(0,0,0,.10), rgba(0,0,0,0) 35%, rgba(255,255,255,.18) 70%, rgba(0,0,0,.04)), repeating-linear-gradient(to bottom, transparent 0 4px, rgba(28,27,26,.13) 4px 5px) content-box no-repeat, var(--pf-paper); }
        .pf-lb-gutter { left: 50%; top: 0; width: 14px; height: 100%; margin-left: -7px; background: linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,.12) 50%, rgba(0,0,0,0)); transform: translateZ(-.5px); }
        /* The turning page: hinged on the spine, softly shaded towards it so it reads as curved paper. */
        .pf-lb-leaf {
          left: 50%; border-radius: 0 2px 2px 0; transform-origin: 0 50%; will-change: transform;
          background:
            linear-gradient(to right, rgba(0,0,0,.10), rgba(0,0,0,0) 35%, rgba(255,255,255,.18) 70%, rgba(0,0,0,.04)),
            repeating-linear-gradient(to bottom, transparent 0 4px, rgba(28,27,26,.13) 4px 5px) content-box no-repeat,
            var(--pf-paper);
          animation: pf-lb-turn var(--pf-loop) var(--pf-first) infinite both;
        }
        /* The turn takes the first 60% of the loop; the page then rests on the left until it starts again. */
        @keyframes pf-lb-turn {
          0% { transform: rotateY(0deg); animation-timing-function: cubic-bezier(.45, 0, .25, 1); }
          60%, 100% { transform: rotateY(-180deg); }
        }
        @media (prefers-reduced-motion: reduce) { .pf-lb-leaf { animation: none; } }
      `}</style>
      <div className="pf-lb-frame" aria-hidden><div className="pf-lb">
        <div className="pf-lb-book">
          <span className="pf-lb-floor" />
          <span className="pf-lb-block" />
          <span className="pf-lb-page pf-lb-left" />
          <span className="pf-lb-page pf-lb-right" />
          <span className="pf-lb-gutter" />
          <span className="pf-lb-leaf" />
        </div>
      </div></div>
      {label ? (
        <p className="text-xs" style={{ color: `rgba(${ink}, 0.7)` }}>
          {label}
          {detail ? <span className="ml-1 tabular-nums opacity-70">{detail}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/** Visible immediately while route data or the viewer bundle is being fetched. */
export function PortfolioLoading() {
  return <div className="flex min-h-[100svh] items-center justify-center bg-[#eae6df]" aria-busy="true"><BookLoader tone="light" label="" /></div>;
}
