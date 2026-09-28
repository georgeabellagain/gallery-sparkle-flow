import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("display-title text-[1.35rem] leading-none", className)}>
      Portfolia
    </Link>
  );
}

/** Platform chrome. Published portfolios never use this. */
export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur">
      <div className="shell flex h-14 items-center justify-between gap-6">
        <div className="flex items-center gap-7">
          <Wordmark />
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            <Link to="/explore" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Explore
            </Link>
            <Link to="/dashboard" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Workspace
            </Link>
            <Link to="/plans" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Plans
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="rule-t mt-20">
      <div className="shell flex flex-col gap-2 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Portfolia — working prototype. Not a live service.</p>
        <p>Portfolios, uploads and versions are stored in this browser only.</p>
      </div>
    </footer>
  );
}

export function PrototypeNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "border-l-2 border-border-strong pl-3 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
