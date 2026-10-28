import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronsLeftRight } from "lucide-react";

/** How long the line rests between sweeps, and how long a sweep takes. */
const REST_MS = 3500, SWEEP_MS = 1100;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Simple and Studio side by side: `children` (the book in the Simple look) shows to the left of a line laid over the
 * Studio book beneath. The line sweeps from one side to the other every few seconds until the reader drags it; it
 * is a keyboard slider too. The overlay never takes pointer input itself, apart from the line.
 */
export function LookCompare({ show, sweep, children }: { show: boolean; sweep: boolean; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5);
  const [auto, setAuto] = useState(true);
  const splitRef = useRef(split);
  splitRef.current = split;

  useEffect(() => {
    if (!show || !auto || !sweep) return;
    let frame = 0, towards = splitRef.current < 0.5 ? 0.82 : 0.18;
    const run = () => {
      const from = splitRef.current, to = towards, start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / SWEEP_MS);
        setSplit(from + (to - from) * ease(t));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      towards = to > 0.5 ? 0.18 : 0.82;
    };
    const first = setTimeout(run, 900);
    const timer = setInterval(run, REST_MS + SWEEP_MS);
    return () => { clearTimeout(first); clearInterval(timer); cancelAnimationFrame(frame); };
  }, [show, auto, sweep]);

  const place = (clientX: number) => {
    const r = host.current?.getBoundingClientRect();
    if (r?.width) setSplit(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)));
  };
  const percent = `${(split * 100).toFixed(2)}%`;
  return (
    <div ref={host} className="pointer-events-none absolute inset-0 z-20" style={{ opacity: show ? 1 : 0, transition: "opacity 400ms" }}>
      <div aria-hidden inert className="absolute inset-0" style={{ clipPath: `inset(0 ${(100 - split * 100).toFixed(2)}% 0 0)` }}>{children}</div>
      {show && <>
        <span className="absolute top-16 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-opacity" style={{ right: `calc(${100 - split * 100}% + 10px)`, opacity: split > 0.12 ? 1 : 0 }}>Simple</span>
        <span className="absolute top-16 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-opacity" style={{ left: `calc(${percent} + 10px)`, opacity: split < 0.88 ? 1 : 0 }}>Studio</span>
        <div
          data-compare-slider
          role="slider"
          tabIndex={0}
          aria-label="Compare the Simple and Studio looks"
          aria-describedby="demo-guide"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split * 100)}
          aria-valuetext={`${Math.round(split * 100)}% Simple`}
          className="pointer-events-auto absolute inset-y-0 w-10 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:[&>span:last-child]:ring-2 focus-visible:[&>span:last-child]:ring-white"
          style={{ left: percent }}
          onPointerDown={(e) => { setAuto(false); e.currentTarget.setPointerCapture(e.pointerId); place(e.clientX); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) place(e.clientX); }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.1 : 0.03;
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); setAuto(false); setSplit((s) => Math.min(0.98, Math.max(0.02, s + (e.key === "ArrowRight" ? step : -step)))); }
          }}
        >
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,.45)]" />
          <span aria-hidden className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-1 ring-black/10">
            <ChevronsLeftRight className="size-5" />
          </span>
        </div>
      </>}
    </div>
  );
}
