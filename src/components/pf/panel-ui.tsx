import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One titled group in a customisation panel; groups are separated by a hairline. */
export function PanelSection({ title, hint, aside, children, className }: { title: string; hint?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 border-t border-border/70 py-4 first:border-t-0 first:pt-0 last:pb-0", className)}>
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
          {aside}
        </div>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** The pressed-button style shared by every option grid in the panels. */
export const optionClass =
  "rounded-xl border border-border bg-background px-2 py-2.5 text-xs font-medium transition-[border-color,background-color,color] hover:border-foreground/30 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background";

/** A labelled slider with its value on the right. */
export function SliderRow({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs">
        <span>{label}</span>
        {value !== undefined && <span className="tabular-nums text-muted-foreground">{value}</span>}
      </span>
      {children}
    </label>
  );
}

/** A setting with a switch on the right. */
export function SwitchRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-3 text-xs">
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
