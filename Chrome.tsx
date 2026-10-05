import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { getBlob } from "@/lib/portfolia/assets";
import { cn } from "@/lib/utils";
import portfoliaLogo from "@/assets/portfolia-logo.png";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center", className)} aria-label="Portfolia home">
      <img src={portfoliaLogo} alt="Portfolia" width={1162} height={257} className="h-6 w-auto lg:h-8 2xl:h-10" />
    </Link>
  );
}

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="rule-b">
      <div className="shell flex h-14 items-center justify-between gap-4 lg:h-16 2xl:h-20">
        <Wordmark />
        <div className="flex items-center gap-3 text-sm">{right}</div>
      </div>
    </header>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("rule-t mt-auto", className)}>
      <div className="shell flex flex-wrap items-center gap-x-6 gap-y-2 py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} George Bell</span>
        <Link to="/pricing" className="hover:underline underline-offset-4">Pricing</Link>
        <Link to="/free-pdf-flipbook" className="hover:underline underline-offset-4">Free PDF flipbook</Link>
        <Link to="/issuu-alternative" className="hover:underline underline-offset-4">Issuu alternative</Link>
        <Link to="/professional-portfolio" className="hover:underline underline-offset-4">Professional portfolio</Link>
        <Link to="/free-pdf-portfolio" className="hover:underline underline-offset-4">Free PDF portfolio</Link>
        <Link to="/terms" className="hover:underline underline-offset-4">Terms</Link>
        <Link to="/privacy" className="hover:underline underline-offset-4">Privacy</Link>
        <Link to="/refund" className="hover:underline underline-offset-4">Refund policy</Link>
      </div>
    </footer>
  );
}

export function DemoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("rounded-2xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export const LOCAL_NOTE =
  "Your PDF and details are saved to your Portfolia account when you sign in, so your link opens on any device.";

/** Accessible modal built on the native <dialog> element. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // When the page closes this dialog itself (because another one is opening, say), the browser still reports "closed".
  // That report must not reach onClose: the page's answer to it would close whatever has just opened. Only a close
  // the page did not ask for (the Escape key) is passed on.
  const closedByPage = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      closedByPage.current = true;
      d.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (closedByPage.current) {
          closedByPage.current = false;
          return;
        }
        onClose();
      }}
      aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,30rem)] rounded-3xl border border-border bg-card p-0 text-foreground shadow-lift backdrop:bg-foreground/30"
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-base font-medium">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-m-1 p-1 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 text-sm">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function useBlob(key?: string) {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let live = true;
    setBlob(null);
    if (key) void getBlob(key).then((b) => live && setBlob(b ?? null));
    return () => {
      live = false;
    };
  }, [key]);
  return blob;
}

export function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
