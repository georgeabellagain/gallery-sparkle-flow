import { ArrowDown, ArrowRight, ArrowUpRight, Asterisk, Check, Circle, CircleDot, CornerRightDown, Eye, Hand, Heart, MousePointerClick, Plus, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";
import { stickerInfo, type PageSticker, type StickerId } from "@/lib/portfolia/page-extras";
import { cn } from "@/lib/utils";

/** The Lucide drawing behind each sticker (Lucide is ISC licensed: free to use, no attribution needed). */
const ICONS: Record<StickerId, LucideIcon> = {
  "arrow-right": ArrowRight,
  "arrow-down": ArrowDown,
  "arrow-up-right": ArrowUpRight,
  "corner-right-down": CornerRightDown,
  circle: Circle,
  "circle-dot": CircleDot,
  star: Star,
  sparkles: Sparkles,
  heart: Heart,
  check: Check,
  pointer: MousePointerClick,
  hand: Hand,
  zap: Zap,
  asterisk: Asterisk,
  eye: Eye,
  plus: Plus,
};

/** One sticker, drawn in its colour and moving its own way (motion rules are in styles.css, .pf-sticker-*). */
export function AnimatedSticker({ sticker, colour, className, still = false }: { sticker: StickerId; colour: string; className?: string; still?: boolean }) {
  const Icon = ICONS[sticker] ?? Star;
  const motion = stickerInfo(sticker)?.motion ?? "pulse";
  return (
    <span aria-hidden className={cn("pf-sticker block h-full w-full", !still && `pf-sticker-${motion}`, className)} style={{ color: colour }}>
      <Icon className="h-full w-full" strokeWidth={2.2} absoluteStrokeWidth={false} />
    </span>
  );
}

/** A sticker placed on a page (a square, positioned as fractions of the page), above the artwork, ignoring clicks. */
export function PageStickerMark({ sticker }: { sticker: PageSticker }) {
  return (
    <span className="pointer-events-none absolute" style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, width: `${sticker.size * 100}%`, aspectRatio: "1" }}>
      <AnimatedSticker sticker={sticker.sticker} colour={sticker.colour} />
    </span>
  );
}
