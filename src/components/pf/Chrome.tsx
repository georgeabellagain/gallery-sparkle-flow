import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { getBlob } from "@/lib/portfolia/assets";
import { cn } from "@/lib/utils";
import portfoliaLogo from "@/assets/portfolia-logo.png";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center", className)} aria-label="Portfolia home">
      <img src={portfoliaLogo} alt="Portfolia" width={1162} height={257} className="h-6 w-auto" />
    </Link>
  );
}

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="rule-b">
      <div className="shell flex h-14 items-center justify-between gap-4">
        <Wordmark />
        <div className="flex items-center gap-3 text-sm">{right}</div>
      </div>
    </header>
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
  "Local prototype: your PDF and details are stored in this browser only. Links work here, but can’t serve your upload to other people or devices until a backend is connected.";

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
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
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
