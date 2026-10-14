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
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState(false),
    [warmClips, setWarmClips] = useState<string[]>([]);
  const lock = useRef(false),
    video = useRef<HTMLVideoElement>(null),
    stage = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLDivElement>(null);
  const complete = useRef<((error?: Error) => void) | null>(null),
    mounted = useRef(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClickUntil = useRef(0);
  const state = pack.states[index]!;
  const cache = useRef(new Map<string, Promise<string>>()), objectUrls = useRef<string[]>([]), preloadAbort = useRef<AbortController | null>(null);
  const queue = useRef<Array<1 | -1>>([]);
  const url = (key: string) => {
    let value=cache.current.get(key);
    if(!value){value=(async()=>{
      const source=await resolveAssetUrl({id:key,blobKey:key});
      if(!source)throw new Error("The rendered file could not load.");
      const response=await fetch(source,{signal:preloadAbort.current?.signal});
      if(!response.ok)throw new Error("The rendered file could not load.");
      const blob=await response.blob();
      if(!mounted.current)throw new Error("Viewer closed.");
      const src=URL.createObjectURL(blob);objectUrls.current.push(src);return src;
    })();cache.current.set(key,value);value.catch(()=>cache.current.delete(key));}
    return value;
  };
  const showStill = async (key: string) => {
    const src = await url(key),
      image = new Image();
    image.src = src;
    await image.decode();
    if (mounted.current) {
      setStill(src);
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
    const abort=new AbortController();preloadAbort.current=abort;setPrepared(false);
    const keys=[...new Set(pack.states.flatMap(s=>[s.still,s.forward,s.backward,...s.notes.flatMap(n=>[n.open,n.close,n.openStill])]).filter((k):k is string=>!!k))];
    let cursor=0;
    const worker=async()=>{while(cursor<keys.length&&!abort.signal.aborted)await url(keys[cursor++]!);};
    void Promise.all([worker(),worker(),worker()]).then(()=>{if(!abort.signal.aborted)setPrepared(true);}).catch(()=>{if(!abort.signal.aborted){setError("The rendered animations could not be prepared. You can switch to live Studio.");onReady(true);}});
    return()=>{abort.abort();objectUrls.current.forEach(URL.revokeObjectURL);objectUrls.current=[];cache.current.clear();};
  },[pack]);
  useEffect(()=>{if(prepared&&still)onReady(true);},[prepared,still]);
  useEffect(()=>{
    let active=true;
    void Promise.all([state.forward,state.backward].filter((key):key is string=>!!key).map(url)).then(sources=>{if(active)setWarmClips(sources);}).catch(()=>{});
    return()=>{active=false;};
  },[index,pack]);
  useEffect(() => {
    if (jump && !lock.current) {
      setOpen(null);
      setIndex(stateForPage(pack, jump.page));
    }
  }, [jump]);
  useEffect(() => {
    if (zoom < 1) onZoomChange(1);
    if (zoom <= 1) setPan({ x: 0, y: 0 });
    else { const box=stage.current?.getBoundingClientRect(); if(box)setPan(v=>({x:Math.max(-box.width*(zoom-1)/2,Math.min(box.width*(zoom-1)/2,v.x)),y:Math.max(-box.height*(zoom-1)/2,Math.min(box.height*(zoom-1)/2,v.y))})); }
  }, [zoom]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const next=Math.max(1,Math.min(3,zoom*Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.002)));
      const box=element.getBoundingClientRect(), ratio=next/zoom;
      const x=event.clientX-box.left-box.width/2, y=event.clientY-box.top-box.height/2;
      setPan(p=>({x:Math.max(-box.width*(next-1)/2,Math.min(box.width*(next-1)/2,x-(x-p.x)*ratio)),y:Math.max(-box.height*(next-1)/2,Math.min(box.height*(next-1)/2,y-(y-p.y)*ratio))}));
      onZoomChange(next);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [zoom, onZoomChange]);
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
  const turn = (direction: 1 | -1) => { if(lock.current){if(queue.current.length<8)queue.current.push(direction);return;}action({direction}); };
  useEffect(()=>{if(!busy&&queue.current.length)turn(queue.current.shift()!);},[busy,index,open]);
  const note = (id: string) => action({ note: id });
  return (
    <section
      onClick={(e) => {
        if (Date.now() < suppressClickUntil.current) return;
        if ((e.target as Element).closest("button,a")) return;
        const box = frame.current?.getBoundingClientRect();
        if (!box) return;
        const x=(e.clientX-box.left)/box.width*100, y=(e.clientY-box.top)/box.height*100;
        if (state.pageBounds && !state.pageBounds.some(b=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height)) return;
        turn(x < 50 ? -1 : 1);
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
      className="pf-book-viewport relative flex items-center justify-center overflow-hidden"
      style={{ height: "auto", aspectRatio: `${pack.width}/${pack.height}` }}
      ref={stage}
    >
      <div
        ref={frame}
        className="relative w-full"
        style={{
          aspectRatio: `${pack.width}/${pack.height}`,
          transform: `translate(${pan.x}px,${pan.y}px) scale(${Math.max(1, zoom)})`,
          touchAction: "none", cursor: zoom > 1 ? "grab" : "pointer",
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button,a") || e.button !== 0) return;
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pointer.current, b = stage.current?.getBoundingClientRect();
          if (!p || p.id !== e.pointerId || !b) return;
          if (Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>5) p.moved = true;
          if (p.moved && zoom > 1) setPan(v => ({
            x: Math.max(-b.width*(zoom-1)/2,Math.min(b.width*(zoom-1)/2,v.x+e.clientX-p.x)),
            y: Math.max(-b.height*(zoom-1)/2,Math.min(b.height*(zoom-1)/2,v.y+e.clientY-p.y)),
          }));
          p.x=e.clientX; p.y=e.clientY;
        }}
        onPointerUp={(e) => {
          if(pointer.current?.moved)suppressClickUntil.current=Date.now()+400;
          pointer.current=null;
          if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => { pointer.current=null; suppressClickUntil.current=Date.now()+400; }}
        onLostPointerCapture={() => { pointer.current=null; }}
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
      {warmClips.map(src=><video key={src} src={src} muted playsInline preload="auto" className="hidden" aria-hidden />)}
      <nav
        aria-label="Rendered book controls"
        className="absolute bottom-4 flex gap-2 rounded-full bg-background/90 p-2 text-xs shadow-soft"
      >
        <button
          disabled={index === 0}
          onClick={() => turn(-1)}
          className="px-2 disabled:opacity-30"
        >
          Previous
        </button>
        <span>
          {index + 1} / {pack.states.length}
        </span>
        <button
          disabled={index === pack.states.length - 1}
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
