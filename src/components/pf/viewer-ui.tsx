import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/portfolia-logo.png";
import { cn } from "@/lib/utils";
import { fitTransform, toneOfHex, type BackgroundFit } from "@/lib/portfolia/background";

/** Whether the backdrop behind the controls is light or dark. */
export type Tone = "light" | "dark";

/**
 * Works out whether the backdrop is light or dark so the icons can stay quiet
 * but readable: pale on dark backgrounds, dark on pale ones. For a picture it
 * looks at the picture's average brightness.
 */
export function useTone(colour: string, imageUrl?: string): Tone {
  const [imageTone, setImageTone] = useState<Tone | null>(null);
  useEffect(() => {
    setImageTone(null);
    if (!imageUrl) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 8;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
        setImageTone(sum / 64 > 150 ? "light" : "dark");
      } catch {
        setImageTone("dark");
      }
    };
    img.src = imageUrl;
    return () => {
      live = false;
    };
  }, [imageUrl]);
  return imageUrl ? imageTone ?? "dark" : toneOfHex(colour);
}

/** Quiet round icon: faint until pointed at. */
export const iconClass = (tone: Tone, large = false) =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 disabled:pointer-events-none disabled:opacity-20",
    large ? "size-11" : "size-9 sm:size-8",
    tone === "dark"
      ? "text-white/55 hover:bg-white/10 hover:text-white aria-pressed:bg-white/15 aria-pressed:text-white aria-checked:bg-white/15 aria-checked:text-white"
      : "text-black/45 hover:bg-black/5 hover:text-black aria-pressed:bg-black/10 aria-pressed:text-black aria-checked:bg-black/10 aria-checked:text-black",
  );

export function IconButton({
  label,
  onClick,
  disabled,
  pressed,
  checked,
  tone,
  large,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** For a toggle (the button opens or closes something). */
  pressed?: boolean;
  /** For one choice in a group. */
  checked?: boolean;
  tone: Tone;
  /** A bigger target, for the page arrows. */
  large?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const state =
    checked !== undefined ? { role: "radio" as const, "aria-checked": checked } : pressed !== undefined ? { "aria-pressed": pressed } : {};
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn(iconClass(tone, large), className)} {...state}>
      {children}
    </button>
  );
}

/** A small floating panel for a few settings. */
export function Panel({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={label} className={cn("rounded-2xl border border-border bg-background/95 p-3 text-xs text-foreground shadow-lift backdrop-blur", className)}>
      {children}
    </div>
  );
}

/** Closes a panel when something outside it is pressed, or Escape is pressed. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [ref, active, onClose]);
}

/** One choice from a few, as a row of buttons rather than a drop-down. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex flex-wrap gap-0.5 rounded-full border border-border p-0.5 text-xs", className)}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-full px-3 py-1 transition-colors", value === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** The colour (or picture) behind the PDF. A picture always covers the area. */
export function BackdropLayer({ colour, imageUrl, fit, className }: { colour: string; imageUrl?: string; fit?: Partial<BackgroundFit>; className?: string }) {
  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden", className)} style={{ background: colour }}>
      {imageUrl && <img src={imageUrl} alt="" draggable={false} className="h-full w-full select-none object-cover" style={{ transform: fitTransform(fit) }} />}
    </div>
  );
}

/**
 * Just the Portfolia mark, linking home. The logo file is the mark followed by the word, so a
 * square window on its left edge shows the mark alone, using the real artwork.
 */
export function LogoMark({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <Link to="/" aria-label="Portfolia home" title="Portfolia" className={cn("inline-flex size-6 overflow-hidden rounded-[3px] opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100", className)}>
      <img src={logo} alt="" draggable={false} className={cn("h-full w-full max-w-none object-cover object-left", tone === "dark" && "brightness-0 invert")} />
    </Link>
  );
}
