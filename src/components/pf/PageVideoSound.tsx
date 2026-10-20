import { Volume2, VolumeX } from "lucide-react";
import type { PageVideo } from "@/lib/portfolia/page-extras";

/**
 * The tap target over a page video. Videos play muted; tapping one turns its sound on (and any other's off).
 * A small speaker in the corner says which state it is in. Taps never turn the page.
 */
export function PageVideoSound({ video, on, onToggle }: { video: Pick<PageVideo, "x" | "y" | "width" | "height" | "name">; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={on ? "Turn video sound off" : "Turn video sound on"}
      aria-pressed={on}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="group pointer-events-auto absolute cursor-pointer bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ left: `${video.x * 100}%`, top: `${video.y * 100}%`, width: `${video.width * 100}%`, height: `${video.height * 100}%` }}
    >
      <span className="absolute bottom-[6%] right-[4%] flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-80 transition-opacity group-hover:opacity-100">
        {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
      </span>
    </button>
  );
}
