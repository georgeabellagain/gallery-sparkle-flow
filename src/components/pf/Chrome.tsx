import { openCookieSettings } from "@/lib/ads-consent";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { getBlob } from "@/lib/portfolia/assets";
import { cn } from "@/lib/utils";
import { TASK_PAGES } from "@/lib/portfolia/task-pages";
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
      <div className="shell grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div><Wordmark /><p className="mt-3 max-w-xs text-sm text-muted-foreground">Your PDF. One simple link.</p><p className="mt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} George Bell</p></div>
        <nav aria-label="Product resources" className="text-xs text-muted-foreground">
          <p className="mb-3 font-medium text-foreground">Explore</p>
          <div className="grid gap-2.5">
            <Link to="/pricing" className="hover:underline">Plans and pricing</Link>
            <Link to="/free-pdf-flipbook" className="hover:underline">PDF flipbooks</Link>
            <Link to="/book-marketing" className="hover:underline">Book marketing</Link>
            <a href="/portfolio-checker" className="hover:underline">PDF checker</a>
            <a href="/embed-flipbook-in-squarespace" className="hover:underline">Embedding guides</a>
            <Link to="/flipbook-alternatives" className="hover:underline">Compare flipbook tools</Link>
          </div>
        </nav>
        {/* Every task page is linked from every footer so search engines find them from any crawled page. */}
        <nav aria-label="Guides" className="text-xs text-muted-foreground">
          <p className="mb-3 font-medium text-foreground">Guides</p>
          <div className="grid gap-2.5">
            {Object.entries(TASK_PAGES).map(([slug, p]) => <a key={slug} href={`/${slug}`} className="hover:underline">{p.label}</a>)}
          </div>
        </nav>
        <nav aria-label="Help and legal" className="text-xs text-muted-foreground">
          <p className="mb-3 font-medium text-foreground">Help</p>
          <div className="grid gap-2.5">
            <Link to="/" hash="about" className="hover:underline">About Portfolia</Link>
            <a href="mailto:hello@portfolia.site" className="hover:underline">Contact support</a>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/refund" className="hover:underline">Refund policy</Link>
            <button type="button" onClick={openCookieSettings} className="text-left hover:underline">Cookie settings</button>
          </div>
        </nav>
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
/**
 * A short page (sign in, a message, a single form): the content in a card centred in the space between the header
 * and a footer that stays at the bottom of the screen.
 */
export function CenteredPage({ title, intro, children, right, wide = false }: { title?: ReactNode; intro?: ReactNode; children?: ReactNode; right?: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader right={right} />
      <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12 sm:py-16">
        <div className={cn("w-full rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-9", wide ? "max-w-lg" : "max-w-sm")}>
          {title && <h1 className="display-title text-center text-3xl">{title}</h1>}
          {intro && <div className="mt-2 text-center text-sm text-muted-foreground">{intro}</div>}
          {children && <div className={title || intro ? "mt-7" : ""}>{children}</div>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title saying what the pop-up is for. */
  description?: ReactNode;
  /** Room for wider content, such as sharing options. */
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
      aria-labelledby={titleId}
      aria-describedby={description ? `${titleId}-d` : undefined}
      className={cn("pf-modal m-auto max-h-[min(88dvh,48rem)] overflow-hidden rounded-3xl border border-border bg-card p-0 text-foreground shadow-lift", wide ? "w-[min(94vw,40rem)]" : "w-[min(94vw,30rem)]")}
    >
      {open && (
        <div className="flex max-h-[min(88dvh,48rem)] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold leading-snug tracking-tight">{title}</h2>
              {description && <p id={`${titleId}-d`} className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-1 text-sm [&_p]:leading-relaxed">{children}</div>
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
