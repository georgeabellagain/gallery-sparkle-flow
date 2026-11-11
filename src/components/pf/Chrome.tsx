import { openCookieSettings } from "@/lib/ads-consent";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { allPortfolios, update, useDoc } from "@/lib/portfolia/store";
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

/** The one public-page menu (design standard): where a visitor from search can go next, and one primary action. */
export const MARKETING_LINKS = [
  { href: "/examples", label: "Examples" },
  { href: "/digital-product-studio", label: "Products" },
  { href: "/book-marketing", label: "For authors" },
  { href: "/pricing", label: "Pricing" },
] as const;

export function MarketingHeader({ uploadHere = false, onHelp }: { uploadHere?: boolean; onHelp?: () => void }) {
  const doc = useDoc();
  const [menu, setMenu] = useState(false);
  const signedIn = doc.account.signedIn || allPortfolios(doc).length > 0;
  const uploadHref = uploadHere ? "#upload" : "/#upload";
  const account = signedIn
    ? <Link to="/dashboard" className="underline-offset-4 hover:underline">My portfolios</Link>
    : <Link to="/signin" className="underline-offset-4 hover:underline">Sign in</Link>;
  return (
    <header className="rule-b">
      <div className="shell flex h-14 items-center justify-between gap-3 lg:h-16 2xl:h-20">
        <Wordmark className="shrink-0" />
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm sm:flex">
          {MARKETING_LINKS.map(l => <a key={l.href} href={l.href} className="underline-offset-4 hover:underline">{l.label}</a>)}
          {onHelp && <button type="button" onClick={onHelp} className="text-muted-foreground hover:text-foreground">Help</button>}
        </nav>
        <div className="flex items-center gap-3 whitespace-nowrap text-sm">
          <span className="hidden sm:inline">{account}</span>
          <a href="/pricing" className="underline-offset-4 hover:underline sm:hidden">Pricing</a>
          <Button asChild size="sm"><a href={uploadHref}>Upload a PDF</a></Button>
          <button type="button" aria-label="Open the menu" aria-haspopup="dialog" onClick={() => setMenu(true)} className="flex size-9 items-center justify-center rounded-full hover:bg-muted sm:hidden"><Menu className="size-5" aria-hidden /></button>
        </div>
      </div>
      <Modal open={menu} onClose={() => setMenu(false)} title="Menu">
        <nav aria-label="Menu" className="grid gap-1 text-base">
          {MARKETING_LINKS.filter(l => l.href !== "/pricing").map(l => <a key={l.href} href={l.href} className="rounded-xl px-3 py-2.5 hover:bg-muted">{l.label}</a>)}
          <span className="rounded-xl px-3 py-2.5 hover:bg-muted" onClick={() => setMenu(false)}>{account}</span>
          {onHelp && <button type="button" onClick={() => { setMenu(false); onHelp(); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-muted">Help</button>}
        </nav>
      </Modal>
    </header>
  );
}

/** Signed-in pages (dashboard, products): email, Account and Sign out, the same on both. */
export function AppHeader({ email, signedIn = true }: { email?: string | null; signedIn?: boolean }) {
  return (
    <SiteHeader
      right={
        <>
          <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
          {signedIn && <Link to="/account" className="text-sm underline-offset-4 hover:underline">Account</Link>}
          {signedIn && (
            <button
              type="button"
              className="text-sm underline-offset-4 hover:underline"
              onClick={() => { void supabase.auth.signOut(); update((d) => ({ ...d, account: { signedIn: false } })); window.location.assign("/"); }}
            >Sign out</button>
          )}
        </>
      }
    />
  );
}
/** Six task pages people search for most; every other guide is on /guides, two clicks from anywhere. */
const FOOTER_GUIDES = ["pdf-to-link", "share-pdf-online", "host-pdf", "pdf-qr-code", "how-to-send-a-portfolio", "send-large-pdf"] as const;

export function SiteFooter({ className }: { className?: string }) {
  const column = "text-xs text-muted-foreground";
  return (
    <footer className={cn("rule-t mt-auto", className)}>
      <div className="shell grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        <div><Wordmark /><p className="mt-3 max-w-xs text-sm text-muted-foreground">Your PDF. One simple link.</p><p className="mt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} George Bell</p></div>
        <nav aria-label="Product" className={column}>
          <p className="mb-3 font-medium text-foreground">Product</p>
          <div className="grid gap-2.5">
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <a href="/examples" className="hover:underline">Examples</a>
            <a href="/digital-product-studio" className="hover:underline">Digital Product Studio</a>
            <Link to="/book-marketing" className="hover:underline">Book marketing</Link>
            <a href="/portfolio-checker" className="hover:underline">PDF checker</a>
          </div>
        </nav>
        <nav aria-label="Guides" className={column}>
          <p className="mb-3 font-medium text-foreground">Guides</p>
          <div className="grid gap-2.5">
            {FOOTER_GUIDES.map((slug) => <a key={slug} href={`/${slug}`} className="hover:underline">{TASK_PAGES[slug]?.label ?? slug}</a>)}
            <a href="/guides" className="font-medium text-foreground hover:underline">All guides</a>
          </div>
        </nav>
        <nav aria-label="Compare" className={column}>
          <p className="mb-3 font-medium text-foreground">Compare</p>
          <div className="grid gap-2.5">
            <Link to="/flipbook-alternatives" className="hover:underline">Flipbook alternatives</Link>
            <a href="/issuu-alternative" className="hover:underline">Issuu alternative</a>
          </div>
        </nav>
        <nav aria-label="Help and legal" className={column}>
          <p className="mb-3 font-medium text-foreground">Help</p>
          <div className="grid gap-2.5">
            <Link to="/" hash="about" className="hover:underline">About Portfolia</Link>
            <a href="mailto:hello@portfolia.site" className="hover:underline">Contact</a>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/refund" className="hover:underline">Refunds</Link>
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
export function CenteredPage({ title, intro, children, right, wide = false, header }: { title?: ReactNode; intro?: ReactNode; children?: ReactNode; right?: ReactNode; wide?: boolean; /** Public pages (sign in) pass MarketingHeader. */ header?: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      {header ?? <SiteHeader right={right} />}
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
