import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Code2, Copy, Eye, Pencil, QrCode, Share2 } from "lucide-react";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE, Modal, useBlob, useObjectUrl } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { PortfolioQrCode } from "@/components/pf/PortfolioQrCode";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/portfolia/assets";
import { sampleAnalytics } from "@/lib/portfolia/sample";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPortalUrl } from "@/lib/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { submitFeedback } from "@/lib/feedback.functions";
import {
  allPortfolios, beginNewPortfolio, canAddPortfolio, isPaid, MAX_PORTFOLIOS, switchPortfolio,
  startPortfolio, personalActive, update, uploadLimitMb, useDoc, type Analytics,
} from "@/lib/portfolia/store";

export const Route = createFileRoute("/dashboard")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Dashboard — Portfolia" },
      { name: "description", content: "Manage your Portfolia portfolio, link, plan and visit statistics." },
      { property: "og:title", content: "Dashboard — Portfolia" },
      { property: "og:description", content: "Manage your Portfolia portfolio, link, plan and visit statistics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const doc = useDoc();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const p = doc.portfolio;
  const [dialog, setDialog] = useState<null | "share" | "upgrade" | "cancel" | "qr" | "embed">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { user, sub, loading, refresh } = useAccount();
  const portal = useServerFn(getPortalUrl);
  const checkoutDone = typeof window !== "undefined" && window.location.search.includes("checkout=success");
  const all = allPortfolios(doc);
  const paid = isPaid(doc);
  const pdfLimitMb = uploadLimitMb(doc);
  const profile = p?.profile ?? all[0]?.profile;
  const profilePhoto = useBlob(profile?.photoKey);
  const profilePhotoUrl = useObjectUrl(profilePhoto);

  if (!hydrated || loading) return null;

  const header = (
    <SiteHeader
      right={
        <>
          <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
          {user && (
            <button className="text-sm hover:underline underline-offset-4" onClick={() => { void supabase.auth.signOut(); update((d) => ({ ...d, account: { signedIn: false } })); void navigate({ to: "/" }); }}>Sign out</button>
          )}
        </>
      }
    />
  );

  if (!user) {
    return (
      <div className="min-h-screen">{header}
        <main className="mx-auto max-w-md px-5 py-24 text-center text-sm">
          <p>Sign in to see your dashboard.</p>
          <Button asChild className="mt-4"><Link to="/signin">Sign in</Link></Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen">{header}
        <main className="shell max-w-[90rem] py-14">
          <h1 className="display-title text-3xl">{all.length ? "Upload your next portfolio" : "No portfolio yet"}</h1>
          {all.length > 0 && <Button size="sm" variant="quiet" className="mt-3" onClick={() => switchPortfolio(all[0]?.code ?? "")}>Cancel</Button>}
          <div className="mt-6 max-w-2xl"><DropZone limitMb={pdfLimitMb} onAccepted={(pdf) => { if (startPortfolio(pdf)) void navigate({ to: "/create" }); }} /></div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const freePath = `/p/${p.code}`;
  const active = personalActive(p);
  const personalPath = p.username && active ? `/${p.username}` : null;
  const sharePath = personalPath ?? freePath;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(origin + sharePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Couldn’t copy automatically — select the address and copy it manually.");
    }
  };
  const openFor = (code: string, action: "share" | "embed" | "qr" | "upgrade" | "cancel") => {
    if (code !== p.code) switchPortfolio(code);
    setCopied(false);
    setDialog(action);
  };
  const editPortfolio = (code: string) => {
    if (code !== p.code) switchPortfolio(code);
    void navigate({ to: "/edit" });
  };

  return (
    <div className="min-h-screen"><PaymentTestModeBanner />{header}
      <main className="shell max-w-[90rem] py-10 sm:py-14">
        <section className="flex flex-col gap-5 border-b border-border pb-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {profilePhotoUrl ? <img src={profilePhotoUrl} alt={profile?.name || "Profile"} className="size-16 shrink-0 rounded-full object-cover sm:size-20" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xl font-medium sm:size-20">{profile?.name?.trim().charAt(0).toUpperCase() || "P"}</div>}
            <div className="min-w-0">
              <p className="label-xs">Profile</p>
              <h1 className="display-title mt-1 truncate text-3xl">{profile?.name || "Your profile"}</h1>
              {profile?.title && <p className="mt-1 text-sm text-muted-foreground">{profile.title}</p>}
            </div>
          </div>
          <Button asChild variant="line"><Link to="/create"><Pencil /> Edit profile</Link></Button>
        </section>

        <section className="py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="label-xs">Library</p><h2 className="display-title mt-1 text-4xl">Portfolios</h2></div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{all.length}/{MAX_PORTFOLIOS}</span>
              {canAddPortfolio(doc) && <Button size="sm" onClick={() => beginNewPortfolio()}>New portfolio</Button>}
            </div>
          </div>

          <div className="mt-8 grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {all.map((portfolio) => {
              const isPublished = portfolio.status === "published";
              return <article key={portfolio.code} className="group min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={`text-xxs font-semibold uppercase ${isPublished ? "text-info" : "text-muted-foreground"}`}>{isPublished ? "Published" : "Unpublished"}</span>
                  <span className="truncate text-xxs text-muted-foreground">{portfolio.pdf?.pages ?? 0} pages</span>
                </div>
                <button type="button" onClick={() => editPortfolio(portfolio.code)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <CatalogueCover blobKey={portfolio.pdf?.blobKey} />
                </button>
                <div className="pt-4">
                  <h3 className="truncate text-sm font-medium">{portfolio.pdf?.name?.replace(/\.pdf$/i, "") || portfolio.profile.name || "Untitled portfolio"}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{portfolio.username && personalActive(portfolio) ? `portfolia.site/${portfolio.username}` : `/p/${portfolio.code}`}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button size="sm" variant="line" onClick={() => openFor(portfolio.code, "share")}><Share2 /> Share</Button>
                    <Button size="sm" variant="line" asChild><Link to="/p/$slug" params={{ slug: portfolio.code }} search={{ preview: "1" }}><Eye /> Preview</Link></Button>
                    <Button size="sm" variant="line" onClick={() => editPortfolio(portfolio.code)}><Pencil /> Edit</Button>
                  </div>
                </div>
              </article>;
            })}
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-10 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium">Plan and account</h2>
            <p className="mt-2 text-sm">{p.plan === "personal" ? `Personal — billed ${p.billing === "month" ? "monthly" : "yearly"}` : "Free"}</p>
            {checkoutDone && !sub && <p role="status" className="mt-1 text-xs text-muted-foreground">Payment received — confirming your plan…</p>}
            {sub?.status === "past_due" && <p role="alert" className="mt-1 text-xs text-destructive">Your last payment didn’t go through. Please update your card.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {p.plan === "free" ? <Button size="sm" onClick={() => setDialog("upgrade")}>See Personal plan</Button> : <>
                <Button size="sm" variant="line" onClick={() => setDialog("upgrade")}>Change address</Button>
                {sub && sub.status !== "canceled" && <Button size="sm" variant="quiet" onClick={() => setDialog("cancel")}>{sub.status === "past_due" ? "Update card" : "Manage billing"}</Button>}
              </>}
            </div>
          </div>
          <AnalyticsPanel data={doc.analytics} />
        </section>
        <DemoNote className="max-w-2xl">{LOCAL_NOTE}</DemoNote>
        <div className="mt-10 max-w-2xl"><FeedbackBox /></div>
      </main>
      <SiteFooter />

      <Modal open={dialog === "share"} onClose={() => setDialog(null)} title="Share portfolio">
        <p className="text-muted-foreground">Share the published version by link, embed or personal QR code.</p>
        <code className="mt-4 block overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs select-all">{origin}{sharePath}</code>
        {msg && <p role="alert" className="mt-3 text-sm text-destructive">{msg}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void copy()}><Copy /> {copied ? "Copied" : "Copy link"}</Button>
          <Button variant="line" onClick={() => setDialog("qr")}><QrCode /> QR code</Button>
          {p.status === "published" && <Button variant="line" onClick={() => setDialog("embed")}><Code2 /> Embed</Button>}
        </div>
        {p.status !== "published" && <p className="mt-4 text-xs text-muted-foreground">Publish this portfolio from Edit before sharing it with visitors.</p>}
      </Modal>
      <PortfolioQrCode open={dialog === "qr"} onClose={() => setDialog(null)} url={origin + sharePath} name={p.profile.name} />
      <EmbedModal open={dialog === "embed"} onClose={() => setDialog(null)} url={`${origin}/embed/${p.code}`} title={p.profile.name || "Portfolio"} />
      <UpgradeModal open={dialog === "upgrade"} onClose={() => setDialog(null)} />
      <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Manage Personal">
        <p className="text-muted-foreground">Your portfolios remain available at their free addresses if you cancel. Nothing is deleted immediately.</p>
        <Confirm onCancel={() => setDialog(null)} label="Open billing page" onConfirm={async () => { setDialog(null); const w = window.open("", "_blank"); try { const url = await portal({ data: { environment: getPaddleEnvironment() } }); if (w) w.location.href = url; else window.location.href = url; } catch { w?.close(); setMsg("Couldn’t open the billing page — try again."); } }} />
      </Modal>
    </div>
  );
}

function CatalogueCover({ blobKey }: { blobKey?: string }) {
  const blob = useBlob(blobKey);
  const src = useMemo(() => (blob ? { blob } : null), [blob]);
  return <div className="relative aspect-[4/5] overflow-hidden bg-muted shadow-[10px_12px_0_var(--color-muted),20px_24px_0_var(--color-border)] transition-transform duration-300 group-hover:-translate-y-1">
    <div className="pointer-events-none h-full overflow-hidden bg-background" aria-hidden><PdfViewer source={src} fileName="" compact viewer={{ mode: "paged", look: "clean", background: "paper", finish: "matte", paper: "smooth", light: "soft", shadow: "none", thickness: "thin", spreads: "single", showHeader: false }} /></div>
  </div>;
}

function EmbedModal({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"scroll" | "paged" | "book">("book");
  const [background, setBackground] = useState<"black" | "paper" | "soft">("black");
  const params = new URLSearchParams({ page: String(page), mode, background });
  const embedUrl = `${url}?${params}`;
  const safeTitle = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const code = `<iframe src="${embedUrl}" title="${safeTitle} portfolio" loading="lazy" allow="fullscreen" style="width:100%;aspect-ratio:16/10;border:0"></iframe><p><a href="${url.replace("/embed/", "/p/")}">View ${safeTitle} portfolio</a></p>`;
  return (
    <Modal open={open} onClose={onClose} title="Embed portfolio">
      <p className="text-muted-foreground">Paste this code into a website that accepts embeds. It always shows the published version.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Starting page<input type="number" min={1} value={page} onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-full border border-input bg-background px-3 py-1.5" /></label>
        <label className="text-xs">Reading mode<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mt-1 w-full rounded-full border border-input bg-background px-3 py-1.5"><option value="scroll">Scroll</option><option value="paged">Page by page</option><option value="book">Flipbook</option></select></label>
        <label className="text-xs">Background<select value={background} onChange={(e) => setBackground(e.target.value as typeof background)} className="mt-1 w-full rounded-full border border-input bg-background px-3 py-1.5"><option value="black">Black</option><option value="paper">Paper</option><option value="soft">Soft grey</option></select></label>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted">
        <iframe key={embedUrl} src={embedUrl} title={`${title} embed preview`} className="aspect-[16/10] w-full border-0" />
      </div>
      <textarea readOnly value={code} aria-label="Portfolio embed code" rows={5} className="mt-4 w-full resize-none rounded-xl border border-border bg-muted p-3 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-4 flex justify-end gap-2"><Button variant="line" onClick={onClose}>Close</Button><Button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? "Copied" : "Copy embed code"}</Button></div>
    </Modal>
  );
}

function Confirm({ onCancel, onConfirm, label }: { onCancel: () => void; onConfirm: () => void; label: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button variant="line" onClick={onCancel}>Keep as is</Button>
      <Button variant="destructive" onClick={onConfirm}>{label}</Button>
    </div>
  );
}

function AnalyticsPanel({ data, sample }: { data: Analytics; sample?: boolean }) {
  const [range, setRange] = useState<7 | 30 | 0>(30);
  const since = range ? Date.now() - range * 864e5 : 0;
  const visits = data.visits.filter((v) => v.t >= since);
  const uniques = new Set(visits.map((v) => v.v)).size;
  const downloads = data.downloads.filter((t) => t >= since).length;
  const days = range || Math.max(7, Math.ceil((Date.now() - Math.min(Date.now(), ...data.visits.map((v) => v.t))) / 864e5) + 1);
  const buckets = Array.from({ length: Math.min(days, 90) }, (_, i) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const s = start.getTime() - (Math.min(days, 90) - 1 - i) * 864e5;
    return visits.filter((v) => v.t >= s && v.t < s + 864e5).length;
  });
  const max = Math.max(1, ...buckets);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Visit statistics {sample && <span className="ml-2 rounded-full border border-border px-2.5 py-0.5 text-xxs uppercase tracking-wider text-muted-foreground">Sample data — example portfolio</span>}</h2>
        <div role="group" aria-label="Time range" className="flex gap-1 text-xs">
          {([[7, "7 days"], [30, "30 days"], [0, "All time"]] as const).map(([r, l]) => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`rounded-full border px-3 py-1 ${range === r ? "border-foreground" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-4">
        <Stat label="Visits" value={visits.length} />
        <Stat label="Unique visitors (est.)" value={uniques} />
        <Stat label="Download clicks" value={downloads} />
      </dl>
      <div className="mt-6 flex h-24 items-end gap-px" role="img" aria-label={`Visits per day, ${visits.length} total`}>
        {buckets.map((b, i) => <div key={i} className="flex-1 bg-foreground/70" style={{ height: `${(b / max) * 100}%`, minHeight: b ? 2 : 1, opacity: b ? 1 : 0.15 }} />)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        A visit is one viewing session — scrolling, zooming or loading more pages doesn’t add visits. Your own previews and known bots are excluded. Unique visitors are estimated per browser. Download clicks count button presses, not completed downloads. Statistics can’t identify who visited or show whether anyone read your work.
        
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="display-title text-3xl tabular-nums">{value}</dd>
    </div>
  );
}

function FeedbackBox() {
  const send = useServerFn(submitFeedback);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      await send({ data: { message: text } });
      setText("");
      setState("sent");
    } catch {
      setState("error");
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="text-sm font-medium">We’d love to hear your thoughts and suggestions</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Anything you’d like to see added, changed or made simpler — tell us below and we’ll read every note. You can also email <a className="underline underline-offset-4" href="mailto:hello@portfolia.site">hello@portfolia.site</a>.</p>
      {state === "sent" ? (
        <p role="status" className="mt-4 text-sm">Thank you — your feedback has reached us.</p>
      ) : (
        <>
          <label htmlFor="feedback-message" className="sr-only">Your feedback</label>
          <textarea
            id="feedback-message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="What works well, what doesn’t, what would make Portfolia better…"
            className="mt-4 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus-visible:border-foreground"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" type="submit" disabled={state === "sending" || text.trim().length < 2}>
              {state === "sending" ? "Sending…" : "Send feedback"}
            </Button>
            {state === "error" && <p role="alert" className="text-xs text-destructive">Couldn’t send — please try again.</p>}
          </div>
        </>
      )}
    </form>
  );
}
