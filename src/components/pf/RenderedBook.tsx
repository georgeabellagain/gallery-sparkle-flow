import { useEffect, useRef, useState } from "react";
import { resolveAssetUrl } from "@/lib/portfolia/assets";
import { stateForPage, renderedAction, type RenderedStudio } from "@/lib/portfolia/rendered-studio";
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
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null),
    suppressClickUntil = useRef(0);
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
  return (
    <section
      onTouchStart={(e) => {
        const t = e.touches[0];
        swipe.current =
          t && zoom <= 1 && !busy && !(e.target as Element).closest("button,a")
            ? { x: t.clientX, y: t.clientY }
            : null;
      }}
      onTouchEnd={(e) => {
        const p = swipe.current,
          t = e.changedTouches[0];
        swipe.current = null;
        if (!p || !t) return;
        const dx = t.clientX - p.x,
          dy = t.clientY - p.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          suppressClickUntil.current = Date.now() + 400;
          turn(dx < 0 ? 1 : -1);
        }
      }}
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
          transform: `translate(${pan.x}px,${pan.y}px) scale(${Math.max(1, zoom)})`,
          touchAction: zoom > 1 ? "none" : "pan-y",
        }}
        onPointerDown={(e) => {
          if (zoom <= 1 || busy || (e.target as Element).closest("button,a")) return;
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pointer.current,
            b = stage.current?.getBoundingClientRect();
          if (!p || p.id !== e.pointerId || !b) return;
          setPan((v) => ({
            x: Math.max(
              (-b.width * (zoom - 1)) / 2,
              Math.min((b.width * (zoom - 1)) / 2, v.x + e.clientX - p.x),
            ),
            y: Math.max(
              (-b.height * (zoom - 1)) / 2,
              Math.min((b.height * (zoom - 1)) / 2, v.y + e.clientY - p.y),
            ),
          }));
          p.x = e.clientX;
          p.y = e.clientY;
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
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
              void video.current?.play().catch(() => {
                complete.current?.(new Error("Playback blocked."));
              });
            }}
            onPlaying={() => setPlaying(true)}
            onEnded={() => complete.current?.()}
            onError={() => {
              complete.current?.(new Error("Video failed."));
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
        {open && (
          <button disabled={busy} onClick={() => note(open)}>
            Close note
          </button>
        )}
      </nav>
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
