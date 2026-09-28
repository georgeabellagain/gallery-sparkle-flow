import { cn } from "@/lib/utils";

/** A small CV mark: a document with a folded corner, a head-and-shoulders portrait and text lines. */
export function CvIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cn("size-4 shrink-0", className)} aria-hidden>
      <path d="M6 2.75h8.5L19 7.25v12.5a1.5 1.5 0 0 1-1.5 1.5h-11.5A1.5 1.5 0 0 1 4.5 19.75V4.25A1.5 1.5 0 0 1 6 2.75Z" />
      <path d="M14.25 2.75v4.5H19" />
      <circle cx="9.25" cy="9.5" r="1.75" />
      <path d="M6.75 14c.4-1.3 1.35-2 2.5-2s2.1.7 2.5 2" />
      <path d="M13 11.5h3M7 17h9" />
    </svg>
  );
}
