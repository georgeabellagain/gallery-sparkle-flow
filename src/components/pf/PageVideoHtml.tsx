import { useEffect, useRef, useState } from "react";
import { publicAssetUrl, resolveAssetUrl } from "@/lib/portfolia/assets";
import { MAX_PLAYING } from "@/lib/portfolia/page-video-player";
import type { PageVideo } from "@/lib/portfolia/page-extras";
import { PageVideoSound } from "./PageVideoSound";

/** Scroll and Page-by-page share one limit: the most recently started videos keep playing. */
const playingNow: HTMLVideoElement[] = [];
const started = (el: HTMLVideoElement) => {
  const i = playingNow.indexOf(el);
  if (i >= 0) playingNow.splice(i, 1);
  playingNow.push(el);
  while (playingNow.length > MAX_PLAYING) playingNow.shift()!.pause();
};
const stopped = (el: HTMLVideoElement) => { const i = playingNow.indexOf(el); if (i >= 0) playingNow.splice(i, 1); };
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const urlOf = async (key: string) => publicAssetUrl(key) ?? (await resolveAssetUrl({ id: key, blobKey: key }));

function OneVideo({ video }: { video: PageVideo }) {
  const el = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string>();
  const [poster, setPoster] = useState<string>();
  const [sound, setSound] = useState(false);
  useEffect(() => {
    let live = true;
    void urlOf(video.posterKey).then((u) => live && setPoster(u));
    void urlOf(video.blobKey).then((u) => live && setSrc(u));
    return () => { live = false; };
  }, [video.blobKey, video.posterKey]);
  // Plays while at least half of it is on screen, muted, unless motion is turned off.
  useEffect(() => {
    const v = el.current;
    if (!v || !src || reduced()) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !document.hidden) void v.play().then(() => started(v)).catch(() => {});
      else { v.pause(); stopped(v); }
    }, { threshold: 0.5 });
    observer.observe(v);
    return () => { observer.disconnect(); v.pause(); stopped(v); };
  }, [src]);
  return (
    <>
      <video
        ref={el}
        src={src}
        poster={poster}
        muted
        data-page-video=""
        onVolumeChange={(e) => setSound(!e.currentTarget.muted)}
        playsInline
        loop
        preload="metadata"
        aria-hidden
        className="pointer-events-none absolute object-cover"
        style={{ left: `${video.x * 100}%`, top: `${video.y * 100}%`, width: `${video.width * 100}%`, height: `${video.height * 100}%` }}
      />
      <PageVideoSound video={video} on={sound} onToggle={() => {
        const v = el.current;
        if (!v) return;
        const next = !sound;
        // Only one video has sound: mute the others on screen.
        if (next) document.querySelectorAll<HTMLVideoElement>("video[data-page-video]").forEach((o) => { if (o !== v) o.muted = true; });
        // The element is the source of truth; onVolumeChange updates the speaker icon.
        v.muted = !next;
        if (next) void v.play().then(() => started(v)).catch(() => {});
      }} />
    </>
  );
}

/** Page videos over a PDF page in Scroll and Page-by-page; the 3D book draws them inside the paper instead. */
export function PageVideoHtml({ videos }: { videos: PageVideo[] }) {
  if (!videos.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {videos.map((v) => <OneVideo key={v.id} video={v} />)}
    </div>
  );
}
