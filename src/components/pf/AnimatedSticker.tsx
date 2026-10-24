import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Asterisk, Bell, Check, Circle, CircleDot, Clock, CornerRightDown, Eye, Flame, Gift, Hand, Heart, Mail, MapPin, Megaphone, MessageCircle, MousePointerClick, PartyPopper, Percent, Phone, Plus, ShoppingBag, Sparkles, Star, Tag, ThumbsUp, Zap, type LucideIcon } from "lucide-react";
import { stickerInfo, type PageSticker, type StickerId } from "@/lib/portfolia/page-extras";
import { cn } from "@/lib/utils";

/** The Lucide drawing behind each icon sticker (Lucide is ISC licensed: free to use, no attribution needed). */
const ICONS: Partial<Record<StickerId, LucideIcon>> = {
  "arrow-right": ArrowRight,
  "arrow-down": ArrowDown,
  "arrow-up-right": ArrowUpRight,
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
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
  percent: Percent,
  "shopping-bag": ShoppingBag,
  tag: Tag,
  gift: Gift,
  bell: Bell,
  megaphone: Megaphone,
  party: PartyPopper,
  flame: Flame,
  "thumbs-up": ThumbsUp,
  message: MessageCircle,
  "map-pin": MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
};

/** A starburst badge with a word on it (drawn here, so there's nothing to license). */
function Badge({ word, colour }: { word: string; colour: string }) {
  const points = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 40 : 48, a = (Math.PI * i) / 12;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <polygon points={points} fill={colour} />
      <text x="50" y="50" dominantBaseline="central" textAnchor="middle" fontFamily="'Instrument Sans', Arial, sans-serif" fontWeight="700" fontSize={word.length > 3 ? 21 : 25} letterSpacing="1" fill="#ffffff">{word}</text>
    </svg>
  );
}
/** Hand-drawn marks: a loose circle round something, or a wavy underline. */
function Scribble({ kind }: { kind: "circle" | "underline" }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      {kind === "circle"
        ? <path d="M62 14C38 9 12 24 10 50c-2 25 22 40 48 37 24-3 34-20 31-40C86 26 66 12 40 18" />
        : <path d="M6 62c10-8 18-8 26 0s16 8 24 0 16-8 24 0 10 6 14 4" />}
    </svg>
  );
}

/** One sticker, drawn in its colour and moving its own way (motion rules are in styles.css, .pf-sticker-*). */
export function AnimatedSticker({ sticker, colour, className, still = false }: { sticker: StickerId; colour: string; className?: string; still?: boolean }) {
  const motion = stickerInfo(sticker)?.motion ?? "pulse";
  const Icon = ICONS[sticker];
  const art = sticker === "badge-sale" ? <Badge word="SALE" colour={colour} />
    : sticker === "badge-new" ? <Badge word="NEW" colour={colour} />
    : sticker === "badge-hot" ? <Badge word="HOT" colour={colour} />
    : sticker === "scribble-circle" ? <Scribble kind="circle" />
    : sticker === "underline" ? <Scribble kind="underline" />
    : (() => { const Drawn = Icon ?? Star; return <Drawn className="h-full w-full" strokeWidth={2.2} absoluteStrokeWidth={false} />; })();
  return (
    <span aria-hidden className={cn("pf-sticker block h-full w-full", !still && `pf-sticker-${motion}`, className)} style={{ color: colour }}>
      {art}
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
