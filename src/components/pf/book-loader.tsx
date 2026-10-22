import type { CSSProperties } from "react";
import type { Tone } from "@/components/pf/viewer-ui";

/** One page turn's share of the loop; three pages turn a third of a loop apart, so one is always moving. */
const LOOP_S = 2.7;
const LEAVES = [0, 1, 2];
/** A short rest before the first turn, so the loader appears as a closed, settled book. */
const FIRST_TURN_S = 0.2;

/**
 * A small open book, tilted towards the reader, whose pages turn one after another without pause. Each page curls
 * as it lifts (two hinged halves), catches the light at the top of its arc and casts a soft shadow on the page below.
 * The book is flattened in depth (scaleZ), so a turning page rolls over close to the paper instead of standing
 * clear of it, which at this size read as a page floating off the book.
 * Only transform and opacity animate, so the browser runs it on the compositor and it stays smooth while the
 * portfolio itself is being prepared on the main thread. A landed page looks exactly like the page beneath it, so
 * it returns to the right-hand stack unseen. Holds still for reduced motion.
 */
export function BookLoader({ tone, label = "Preparing your portfolio…", detail }: { tone: Tone; label?: string; detail?: string }) {
  const ink = tone === "dark" ? "255,255,255" : "28,27,26";
  const paper = tone === "dark" ? "#f3efe6" : "#ffffff";
  const line = "rgba(28,27,26,0.13)";
  return (
    <div role="status" aria-live="polite" aria-label={label || "Loading portfolio"} className="flex flex-col items-center gap-4" style={{ "--pf-ink": ink, "--pf-paper": paper, "--pf-line": line, "--pf-loop": `${LOOP_S}s` } as CSSProperties}>
      <style>{`
        .pf-lb { position: relative; width: 76px; height: 52px; perspective: 260px; perspective-origin: 50% 0%; }
        .pf-lb-book { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateX(38deg) rotateZ(-14deg) scaleZ(.5); }
        .pf-lb-floor { position: absolute; left: -10%; right: -10%; bottom: -28%; height: 40%; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.22), rgba(0,0,0,0)); transform: translateZ(-2px); }
        /* Text lines inside the margins, paper everywhere: two background layers with their own boxes. */
        .pf-lb-page, .pf-lb-half { box-sizing: border-box; background: repeating-linear-gradient(to bottom, transparent 0 4px, var(--pf-line) 4px 5px) content-box no-repeat, var(--pf-paper); }
        .pf-lb-page { position: absolute; top: 0; width: 50%; height: 100%; padding: 7px 6px; }
        /* The page block beneath: a few paper edges stepping down at the foot and outer edge. */
        .pf-lb-block { position: absolute; inset: 0 -1px; border-radius: 2px; background: var(--pf-paper); transform: translateZ(-1.5px); box-shadow: 0 1.5px 0 0 #e6e1d6, 0 3px 0 0 #dcd6c9, 0 4.5px 7px -2px rgba(0,0,0,.28); }
        .pf-lb-left, .pf-lb-right { box-shadow: 0 0 0 .5px rgba(0,0,0,.07); }
        .pf-lb-left { left: 0; border-radius: 2px 0 0 2px; transform: translateZ(-1px); }
        .pf-lb-right { left: 50%; border-radius: 0 2px 2px 0; transform: translateZ(-1px); }
        .pf-lb-gutter { position: absolute; left: 50%; top: 0; width: 14px; height: 100%; margin-left: -7px; background: linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,.12) 50%, rgba(0,0,0,0)); transform: translateZ(-.5px); pointer-events: none; }
        .pf-lb-set { position: absolute; inset: 0; transform-style: preserve-3d; }
        .pf-lb-leaf { position: absolute; top: 0; left: 50%; width: 25%; height: 100%; transform-style: preserve-3d; transform-origin: 0 50%; will-change: transform; animation: pf-lb-turn var(--pf-loop) infinite both; }
        .pf-lb-half { position: absolute; top: 0; height: 100%; width: 100%; padding: 7px 0 7px 6px; transform-style: preserve-3d; }
        .pf-lb-outer { left: 100%; padding: 7px 6px 7px 0; transform-origin: 0 50%; will-change: transform; animation: pf-lb-curl var(--pf-loop) infinite both; border-radius: 0 2px 2px 0; }
        .pf-lb-light { position: absolute; inset: 0; pointer-events: none; opacity: 0; will-change: opacity; animation: pf-lb-light var(--pf-loop) infinite both; }
        .pf-lb-inner .pf-lb-light { background: linear-gradient(to right, rgba(0,0,0,.10), rgba(255,255,255,.35)); }
        .pf-lb-outer .pf-lb-light { background: linear-gradient(to right, rgba(255,255,255,.35), rgba(0,0,0,.14)); }
        .pf-lb-shade { position: absolute; top: 0; height: 100%; width: 50%; pointer-events: none; opacity: 0; will-change: opacity; transform: translateZ(-.75px); }
        .pf-lb-shade-r { left: 50%; background: linear-gradient(to right, rgba(0,0,0,.26), rgba(0,0,0,0) 85%); animation: pf-lb-shade-r var(--pf-loop) infinite both; }
        .pf-lb-shade-l { left: 0; background: linear-gradient(to left, rgba(0,0,0,.22), rgba(0,0,0,0) 85%); animation: pf-lb-shade-l var(--pf-loop) infinite both; }
        /* The turn takes the first 44% of the loop; the page then rests on the left until the loop restarts. */
        @keyframes pf-lb-turn {
          0% { transform: rotateY(0deg); animation-timing-function: cubic-bezier(.5, 0, .3, 1); }
          44%, 100% { transform: rotateY(-180deg); }
        }
        /* The outer half lags as the page lifts, then whips over and settles as it lands. */
        @keyframes pf-lb-curl {
          0% { transform: rotateY(0deg); animation-timing-function: cubic-bezier(.4, 0, .6, 1); }
          13% { transform: rotateY(34deg); animation-timing-function: cubic-bezier(.4, 0, .6, 1); }
          29% { transform: rotateY(-4deg); animation-timing-function: cubic-bezier(.4, 0, .6, 1); }
          38% { transform: rotateY(-16deg); animation-timing-function: cubic-bezier(.3, 0, .2, 1); }
          44%, 100% { transform: rotateY(0deg); }
        }
        @keyframes pf-lb-light { 0% { opacity: 0; } 22% { opacity: 1; } 44%, 100% { opacity: 0; } }
        @keyframes pf-lb-shade-r { 0% { opacity: 0; } 9% { opacity: 1; } 24%, 100% { opacity: 0; } }
        @keyframes pf-lb-shade-l { 0%, 22% { opacity: 0; } 36% { opacity: 1; } 46%, 100% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .pf-lb-leaf, .pf-lb-outer, .pf-lb-light, .pf-lb-shade-r, .pf-lb-shade-l { animation: none; }
        }
      `}</style>
      <div className="pf-lb" aria-hidden>
        <div className="pf-lb-book">
          <span className="pf-lb-floor" />
          <span className="pf-lb-block" />
          <span className="pf-lb-page pf-lb-left" />
          <span className="pf-lb-page pf-lb-right" />
          <span className="pf-lb-gutter" />
          {LEAVES.map((i) => {
            // Positive delays: on the very first frame every page lies on the book, and the turns begin one by one.
            const delay = { animationDelay: `${FIRST_TURN_S + (i * LOOP_S) / LEAVES.length}s` };
            return (
              <span key={i} className="pf-lb-set">
                <span className="pf-lb-shade pf-lb-shade-r" style={delay} />
                <span className="pf-lb-shade pf-lb-shade-l" style={delay} />
                <span className="pf-lb-leaf" style={delay}>
                  <span className="pf-lb-half pf-lb-inner">
                    <span className="pf-lb-light" style={delay} />
                    <span className="pf-lb-half pf-lb-outer" style={delay}>
                      <span className="pf-lb-light" style={delay} />
                    </span>
                  </span>
                </span>
              </span>
            );
          })}
        </div>
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

/** Visible immediately while route data or the viewer bundle is being fetched. */
export function PortfolioLoading() {
  return <div className="flex min-h-[100svh] items-center justify-center bg-[#eae6df]" aria-busy="true"><BookLoader tone="light" label="" /></div>;
}
