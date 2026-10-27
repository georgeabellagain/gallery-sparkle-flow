import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small (i) beside a label that shows a box of extra words on hover or keyboard focus, and on tap on a touch
 * screen. For explaining a setting or a figure without filling the page with text.
 */
export function InfoTip({ children, label = "More information", side = "top", className }: { children: ReactNode; label?: string; side?: "top" | "bottom"; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={cn("relative inline-flex align-middle", className)} onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }} onPointerLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined} onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground">
        <Info className="size-3.5" aria-hidden />
      </button>
      {open && (
        <span role="tooltip" id={id}
          className={cn("absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 rounded-xl bg-foreground px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-background shadow-lift", side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5")}>
          {children}
        </span>
      )}
    </span>
  );
}
