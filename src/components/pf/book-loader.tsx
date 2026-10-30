import type { CSSProperties } from "react";
import type { Tone } from "@/components/pf/viewer-ui";

/** Flat page fan: one line turns over a semicircle of resting pages. */
export function BookLoader({ tone, label = "Preparing your portfolio…", detail }: { tone: Tone; label?: string; detail?: string }) {
  const ink = tone === "dark" ? "255,255,255" : "28,27,26";
  return (
    <div role="status" aria-live="polite" aria-label={label || "Loading portfolio"} className="flex flex-col items-center gap-2" style={{ color: `rgb(${ink})` } as CSSProperties}>
      <style>{`
        .pf-page-fan { width: 64px; height: 37px; overflow: visible; }
        .pf-page-fan .pf-page-turn { transform-origin: 40px 40px; animation: pf-page-fan-turn 1.8s infinite; }
        @keyframes pf-page-fan-turn {
          0%, 12% { transform: rotate(0deg); opacity: 0; }
          16% { opacity: 1; }
          78%, 88% { transform: rotate(-180deg); opacity: 1; }
          92%, 100% { transform: rotate(-180deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .pf-page-fan .pf-page-turn { animation: none; transform: rotate(-75deg); } }
      `}</style>
      <svg className="pf-page-fan" viewBox="0 0 80 46" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <g opacity=".24">
          {[0, 30, 60, 90, 120, 150, 180].map(angle => <line key={angle} x1="40" y1="40" x2="72" y2="40" transform={`rotate(${-angle} 40 40)`} />)}
        </g>
        <line className="pf-page-turn" x1="40" y1="40" x2="72" y2="40" strokeWidth="2" />
      </svg>
      <span aria-hidden="true" className="display-title text-lg leading-none tracking-tight">Portfolia</span>
      {label && <p className="text-xs opacity-70">{label}{detail && <span className="ml-1 tabular-nums">{detail}</span>}</p>}
    </div>
  );
}

/** Visible immediately while route data or the viewer bundle is being fetched. */
export function PortfolioLoading() {
  return <div className="flex min-h-[100svh] items-center justify-center bg-[#eae6df]" aria-busy="true"><BookLoader tone="light" label="" /></div>;
}
