import { useEffect, useRef, useState } from "react";
import { resolveAssetUrl } from "@/lib/portfolia/assets";
import { stateForPage, renderedAction, type RenderedStudio } from "@/lib/portfolia/rendered-studio";
import { turnVideoTime } from "@/lib/portfolia/turn-motion";
import { normaliseUrl } from "@/lib/portfolia/page-extras";

export function RenderedBook({
  pack,
  zoom,
  jump,
  onPage,
  onZoomChange,
  onReady,
  onFallback,
  fill = false,
}: {
  fill?: boolean;
  pack: RenderedStudio;
  zoom: number;
  jump: { page: number; t: number } | null;
  onPage: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onReady: (ready: boolean) => void;
  onFallback: () => void;
}) {
  const [index, setIndex] = useState(() => stateForPage(pack, jump?.page ?? 1));
  const [open, setOpen] = useState<string | null>(null),
    [still, setStill] = useState(""),
    [clip, setClip] = useState(""),
    [playing, setPlaying] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    video = useRef<HTMLVideoElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const complete = useRef<((error?: Error) => void) | null>(null),
    mounted = useRef(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; startX: number; startY: number; width: number; direction: 1 | -1; mode: "pending" | "pan" | "turn"; released?: boolean; cancelled?: boolean } | null>(null);
  const scrub = useRef<{ direction: 1 | -1; progress: number; ready: boolean; released: boolean; commit: boolean; settling: boolean; resolve: () => void } | null>(null);
  const suppressClickUntil = useRef(0);
  const state = pack.states[index]!;
  const url = async (key: string) => {
    const value = await resolveAssetUrl({ id: key, blobKey: key });
    if (!value) throw new Error("The rendered file could not load.");
    return value;
  };
  const showStill = async (key: string) => {
    const src = await url(key),
      image = new Image();
    image.src = src;
    await image.decode();
    if (mounted.current) {
      setStill(src);
      onReady(true);
    }
  };
  useEffect(() => {
    mounted.current = true;
    onReady(false);
    return () => {
      mounted.current = false;
      complete.current?.();
      scrub.current?.resolve();
    };
  }, []);
  useEffect(() => {
    void showStill(state.still).catch(() => {
      setError("The rendered page could not load.");
      onReady(true);
    });
    onPage(state.pages[0] ?? 1);
  }, [index, pack]);
  useEffect(() => {
    for (const key of [state.forward, state.backward]) if (key) void url(key).catch(() => {});
  }, [index, pack]);
  useEffect(() => {
    if (jump && !lock.current) {
      setOpen(null);
      setIndex(stateForPage(pack, jump.page));
    }
  }, [jump]);
  useEffect(() => {
    if (zoom < 1) onZoomChange(1);
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);
  const play = async (key: string) => {
    const src = await url(key);
    if (!mounted.current) return;
    await new Promise<void>((resolve, reject) => {
      complete.current = () => resolve();
      setPlaying(false);
      setClip(src);
      const timeout = window.setTimeout(() => {
        complete.current = null;
        reject(new Error("Video playback timed out."));
      }, 30000);
      complete.current = (error) => {
        clearTimeout(timeout);
        error ? reject(error) : resolve();
      };
    });
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch {
      setError("Rendered playback failed. You can switch to live Studio.");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setPlaying(false);
        setClip("");
        setBusy(false);
      }
    }
  };
  const action = (request: { direction: 1 | -1 } | { note: string }) =>
    void run(async () => {
      const plan = renderedAction(pack, index, open, request);
      if (!plan) return;
      for (const key of plan.clips) {
        await play(key);
        if (state.notes.find((n) => n.id === open)?.close === key) await showStill(state.still);
      }
      await showStill(plan.still);
      setOpen(plan.opened);
      setIndex(plan.index);
    });
  const turn = (direction: 1 | -1) => action({ direction });
  const note = (id: string) => action({ note: id });
  const seek = async (element: HTMLVideoElement, time: number) => {
    if (Math.abs(element.currentTime - time) < .001 && !element.seeking) return;
    await new Promise<void>((resolve, reject) => {
      const finish = () => { clearTimeout(timer); element.removeEventListener("seeked", finish); resolve(); };
      const timer = window.setTimeout(() => { element.removeEventListener("seeked", finish); reject(new Error("Video seeking timed out.")); }, 5000);
      element.addEventListener("seeked", finish);
      element.currentTime = time;
    });
  };
  const settleScrub = async () => {
    const gesture = scrub.current, element = video.current;
    if (!gesture || !gesture.ready || !gesture.released || gesture.settling || !element) return;
    gesture.settling = true;
    try {
      const from = gesture.progress, to = gesture.commit ? 1 : 0, start = performance.now();
      // Paused video seeking supports both forward completion and rewind.
      while (mounted.current && scrub.current === gesture) {
        const t = Math.min(1, (performance.now() - start) / 240);
        const eased = t * t * (3 - 2 * t);
        await seek(element, Math.max(0, Math.min(element.duration - .001, turnVideoTime(from + (to - from) * eased) * element.duration)));
        if (t === 1) break;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      }
      if (!mounted.current || scrub.current !== gesture) return;
      const next = gesture.commit ? index + gesture.direction : index;
      await showStill(pack.states[next]!.still);
      setIndex(next); setOpen(null);
    } catch {
      setError("Rendered dragging failed. You can switch to live Studio.");
    } finally {
      if (scrub.current === gesture) scrub.current = null;
      gesture.resolve();
    }
  };
  const startScrub = (direction: 1 | -1) => {
    const capturedPointer = pointer.current;
    const plan = renderedAction(pack, index, open, { direction });
    if (!plan) return;
    void run(async () => {
      // A note must close before scrubbing the page turn itself.
      for (const key of plan.clips.slice(0, -1)) await play(key);
      if (open) { await showStill(state.still); setOpen(null); }
      const src = await url(plan.clips.at(-1)!);
      if (!mounted.current) return;
      await new Promise<void>(resolve => {
        const p = capturedPointer;
        const progress = p ? Math.max(0, Math.min(1, direction * (p.startX - p.x) / (p.width * .5))) : 0;
        const timeout = window.setTimeout(() => {
          if(scrub.current?.resolve === finish) { setError("The turn video could not load. You can switch to live Studio."); scrub.current=null; finish(); }
        }, 30000);
        const finish = () => { clearTimeout(timeout); resolve(); };
        scrub.current = { direction, progress, ready: false, released: !p || !!p.released, commit: !!p?.released && !p.cancelled && progress > .45, settling: false, resolve: finish };
        setPlaying(false); setClip(src);
      });
    });
  };
  const releasePointer = (cancelled: boolean) => {
    const p = pointer.current;
    pointer.current = null;
    if (!p) return;
    p.released = true; p.cancelled = cancelled;
    if (p.mode !== "pending") suppressClickUntil.current = Date.now() + 400;
    const gesture = scrub.current;
    if (gesture) {
      gesture.released = true;
      gesture.commit = !cancelled && gesture.progress > .45;
      void settleScrub();
    }
  };
  return (
    <section
      onClick={(e) => {
        if (Date.now() < suppressClickUntil.current) return;
        if (zoom > 1 || busy || (e.target as Element).closest("button,a")) return;
        const box = e.currentTarget.getBoundingClientRect();
        turn(e.clientX - box.left < box.width / 2 ? -1 : 1);
      }}
      aria-label="Rendered Studio flipbook"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          turn(1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          turn(-1);
        }
      }}
      className="relative flex min-h-[420px] items-center justify-center overflow-hidden"
      style={{ height: fill ? "100dvh" : "66vh" }}
      ref={stage}
    >
      <div
        className="relative aspect-video w-full"
        style={{
          maxWidth: fill ? "calc(100dvh * 16 / 9)" : "calc(66vh * 16 / 9)",
          transform: `translate(${pan.x}px,${pan.y}px) scale(${Math.max(1, zoom)})`,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          if (busy || (e.target as Element).closest("button,a") || e.button !== 0) return;
          const box = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - box.left) / box.width * 100, y = (e.clientY - box.top) / box.height * 100;
          const onPage = (state.pageBounds ?? [{ x: 10, y: 10, width: 80, height: 80 }]).some(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
          const direction = x < 50 ? -1 : 1;
          const canTurn = direction === 1 ? !!state.forward : !!state.backward;
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, width: box.width, direction, mode: onPage && canTurn && !e.shiftKey ? "pending" : "pan" };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pointer.current, b = stage.current?.getBoundingClientRect();
          if (!p || p.id !== e.pointerId || !b) return;
          const dx = e.clientX - p.startX, dy = e.clientY - p.startY;
          if (p.mode === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 5) {
            p.mode = Math.abs(dx) > Math.abs(dy) ? "turn" : "pan";
            if (p.mode === "turn") startScrub(p.direction);
          }
          if (p.mode === "pan" && zoom > 1) {
            setPan(v => ({
              x: Math.max(-b.width * (zoom - 1) / 2, Math.min(b.width * (zoom - 1) / 2, v.x + e.clientX - p.x)),
              y: Math.max(-b.height * (zoom - 1) / 2, Math.min(b.height * (zoom - 1) / 2, v.y + e.clientY - p.y)),
            }));
          }
          p.x = e.clientX; p.y = e.clientY;
          const gesture = scrub.current;
          if (p.mode === "turn" && gesture && !gesture.released) {
            gesture.progress = Math.max(0, Math.min(1, p.direction * (p.startX - e.clientX) / (p.width * .5)));
            const element = video.current;
            if (gesture.ready && element && Number.isFinite(element.duration)) element.currentTime = Math.min(element.duration - .001, turnVideoTime(gesture.progress) * element.duration);
          }
        }}
        onPointerUp={(e) => { releasePointer(false); if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => releasePointer(true)}
        onLostPointerCapture={() => releasePointer(true)}
      >
        {still && (
          <img
            src={still}
            alt={`Portfolio pages ${state.pages.join(" and ")}`}
            className="block w-full"
            draggable={false}
          />
        )}
        {clip && (
          <video
            ref={video}
            key={clip}
            src={clip}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full"
            style={{ opacity: playing ? 1 : 0 }}
            onLoadedData={() => {
              const gesture = scrub.current, element = video.current;
              if (gesture && element) {
                element.pause(); gesture.ready = true; setPlaying(true);
                element.currentTime = Math.max(0, Math.min(element.duration - .001, turnVideoTime(gesture.progress) * element.duration));
                if (gesture.released) void settleScrub();
                return;
              }
              void video.current?.play().catch(() => {
                complete.current?.(new Error("Playback blocked."));
              });
            }}
            onPlaying={() => setPlaying(true)}
            onEnded={() => complete.current?.()}
            onError={() => {
              complete.current?.(new Error("Video failed."));
              if(scrub.current) { setError("Rendered dragging failed. You can switch to live Studio."); scrub.current.resolve(); scrub.current=null; }
            }}
          />
        )}
        {!busy &&
          state.notes.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-label={`${open === n.id ? "Close" : "Open"} ${n.label}`}
              className="absolute cursor-pointer"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                width: `${n.width}%`,
                height: `${n.height}%`,
              }}
              onClick={() => note(n.id)}
            />
          ))}
        {!busy &&
          !open &&
          state.links.map((l) => {
            if (l.page)
              return (
                <button
                  key={l.id}
                  aria-label={`Go to ${l.label}`}
                  className="absolute"
                  style={{
                    left: `${l.x}%`,
                    top: `${l.y}%`,
                    width: `${l.width}%`,
                    height: `${l.height}%`,
                  }}
                  onClick={() => {
                    setOpen(null);
                    setIndex(stateForPage(pack, l.page!));
                  }}
                />
              );
            const href = normaliseUrl(l.url ?? "");
            return href ? (
              <a
                key={l.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={l.label || href}
                className="absolute"
                style={{
                  left: `${l.x}%`,
                  top: `${l.y}%`,
                  width: `${l.width}%`,
                  height: `${l.height}%`,
                }}
              />
            ) : null;
          })}
      </div>
      <nav
        aria-label="Rendered book controls"
        className="absolute bottom-4 flex gap-2 rounded-full bg-background/90 p-2 text-xs shadow-soft"
      >
        <button
          disabled={busy || index === 0}
          onClick={() => turn(-1)}
          className="px-2 disabled:opacity-30"
        >
          Previous
        </button>
        <span>
          {index + 1} / {pack.states.length}
        </span>
        <button
          disabled={busy || index === pack.states.length - 1}
          onClick={() => turn(1)}
          className="px-2 disabled:opacity-30"
        >
          Next
        </button>
        <button onClick={() => onZoomChange(Math.max(1, zoom - .25))} aria-label="Zoom out" className="px-2">−</button>
        <button onClick={() => onZoomChange(Math.min(3, zoom + .25))} aria-label="Zoom in" className="px-2">+</button>
        <button onClick={() => { onZoomChange(1); setPan({x:0,y:0}); }} className="px-2">Reset</button>
        {open && (
          <button disabled={busy} onClick={() => note(open)}>
            Close note
          </button>
        )}
      </nav>
      {zoom > 1 && !busy && <p className="absolute top-3 rounded-xl bg-background/90 p-2 text-xs">Drag a page to turn. Drag the background or hold Shift to pan.</p>}
      {busy && !playing && (
        <p role="status" className="absolute top-3 rounded-xl bg-background/90 p-2 text-xs">
          Preparing animation…
        </p>
      )}
      {error && (
        <div role="alert" className="absolute top-3 rounded-xl bg-background p-3 text-sm">
          {error}{" "}
          <button className="underline" onClick={onFallback}>
            Use live Studio
          </button>
        </div>
      )}
    </section>
  );
}
