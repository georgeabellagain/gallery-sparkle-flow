import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronsLeftRight } from "lucide-react";

const REVEAL_MS = 1100;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Simple stays fully visible while Studio warms behind it. Both readers keep their scenes. */
export function LookCompare({ show, active, motion, children }: { show: boolean; active: boolean; motion: boolean; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(1);
  const [manual, setManual] = useState(false);
  const completed = useRef(false);
  const elapsed = useRef(0);
  const dragging = useRef(false);
  useEffect(() => {
    if (!show || manual || completed.current) return;
    if (!motion) { setSplit(0.5); completed.current = true; return; }
    let frame = 0, previous = performance.now();
    const step = (now: number) => {
      elapsed.current += now - previous; previous = now;
      const t = Math.min(1, elapsed.current / REVEAL_MS);
      setSplit(1 - 0.5 * ease(t));
      if (t < 1) frame = requestAnimationFrame(step);
      else completed.current = true;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [show, manual, motion]);
  const place = (clientX: number) => {
    const r = host.current?.getBoundingClientRect();
    if (r?.width) setSplit(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)));
  };
  const percent = `${(split * 100).toFixed(2)}%`;
  return <div ref={host} data-demo-comparison={show ? "ready" : "preparing"} className="pointer-events-none absolute inset-0 z-20" hidden={!active}>
    <div aria-hidden={show || !active} inert={show || !active} className={show ? "absolute inset-0" : "pointer-events-auto absolute inset-0"} style={{ clipPath: show ? `inset(0 ${(100 - split * 100).toFixed(2)}% 0 0)` : undefined }}>{children}</div>
    {show && <>
      <span className="absolute top-16 rounded-full bg-foreground/80 px-2.5 py-1 text-[11px] font-medium text-background" style={{ right: `calc(${100 - split * 100}% + 10px)` }}>Simple</span>
      <span className="absolute top-16 rounded-full bg-foreground/80 px-2.5 py-1 text-[11px] font-medium text-background" style={{ left: `calc(${percent} + 10px)`, opacity: split < 0.88 ? 1 : 0 }}>Studio</span>
      <div data-compare-slider role="slider" tabIndex={0} aria-label="Compare the Simple and Studio looks" aria-describedby="demo-guide" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split * 100)} aria-valuetext={`${Math.round(split * 100)}% Simple`}
        className="pointer-events-auto absolute inset-y-0 w-10 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:[&>span:last-child]:ring-2 focus-visible:[&>span:last-child]:ring-ring" style={{ left: percent }}
        onPointerDown={e => { setManual(true); dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); place(e.clientX); }}
        onPointerMove={e => { if (dragging.current && e.currentTarget.hasPointerCapture(e.pointerId)) place(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={e => {
          const step = e.shiftKey ? 0.1 : 0.03;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
            e.preventDefault(); e.stopPropagation(); setManual(true);
            setSplit(s => e.key === "Home" ? 0.02 : e.key === "End" ? 0.98 : Math.min(0.98, Math.max(0.02, s + (e.key === "ArrowRight" ? step : -step))));
          }
        }}>
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-background shadow-soft" />
        <span aria-hidden className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-foreground shadow-lift ring-1 ring-border"><ChevronsLeftRight className="size-5" /></span>
      </div>
    </>}
  </div>;
}
