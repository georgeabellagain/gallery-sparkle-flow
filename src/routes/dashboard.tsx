import { AnalyticsPanel } from "@/components/pf/AnalyticsPanel";
import { totalAnalytics } from "@/lib/portfolia/analytics";
import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Pencil, Share2, Upload } from "lucide-react";
import { SiteHeader, SiteFooter, Modal, useBlob, useObjectUrl } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { ShareActions } from "@/components/pf/ShareActions";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/portfolia/assets";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPortalUrl } from "@/lib/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { submitFeedback } from "@/lib/feedback.functions";
import {
  allPortfolios, beginNewPortfolio, canAddPortfolio, isPaid, MAX_PORTFOLIOS, switchPortfolio,
  getDoc, startPortfolio, personalActive, update, uploadLimitMb, useDoc,
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
  const [dialog, setDialog] = useState<null | "share" | "upgrade" | "cancel" | "limit">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { user, sub, loading, refresh } = useAccount();
  const portal = useServerFn(getPortalUrl);
  const checkoutDone = typeof window !== "undefined" && window.location.search.includes("checkout=success");
  const all = allPortfolios(doc);
  const paid = isPaid(doc);
  const pdfLimitMb = uploadLimitMb(doc);
  const profile = p?.profile ?? all[0]?.profile;
  const profilePhoto = useBlob(profile?.photoKey);
  const profilePhotoUrl = useObjectUrl(profilePhoto);

  if (!hydrated || loading) return <div className="flex min-h-screen flex-col"><SiteHeader /><main className="shell flex-1 py-16" aria-busy="true"><h1 className="display-title text-3xl">Your portfolios</h1><p role="status" className="mt-4 text-sm text-muted-foreground">Loading your workspace…</p></main></div>;

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
        <main className="shell py-14">
          <h1 className="display-title text-3xl">{all.length ? "Upload your next portfolio" : "No portfolio yet"}</h1>
          {all.length > 0 && <Button size="sm" variant="quiet" className="mt-3" onClick={() => switchPortfolio(all[0]?.code ?? "")}>Cancel</Button>}
          <div className="mt-6 max-w-2xl"><DropZone limitMb={pdfLimitMb} onAccepted={(pdf) => { if (startPortfolio(pdf)) void navigate({ to: getDoc().portfolio?.profile.name.trim() ? "/edit" : "/create" }); }} /></div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const openFor = (code: string, action: "share" | "upgrade" | "cancel") => {
    if (code !== p.code) switchPortfolio(code);
    setDialog(action);
  };
  const editPortfolio = (code: string) => {
    if (code !== p.code) switchPortfolio(code);
    void navigate({ to: "/edit" });
  };
  // Upload another portfolio. Where the plan allows it the upload box opens; otherwise the person is asked whether to upgrade.
  const uploadNew = () => {
    if (canAddPortfolio(doc)) beginNewPortfolio();
    else setDialog("limit");
  };

  return (
    <div className="min-h-screen"><PaymentTestModeBanner />{header}
      <main className="shell py-8 sm:py-10">
        {msg && <p role="alert" className="mb-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{msg}</p>}
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
              <span className="text-xs text-muted-foreground">{all.length}/{paid ? MAX_PORTFOLIOS : 1}</span>
              <Button size="sm" onClick={uploadNew}><Upload /> Upload portfolio</Button>
            </div>
          </div>

          <div className="mt-8 grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {all.map((portfolio) => {
              const isPublished = portfolio.status === "published";
              return <article key={portfolio.code} className="group min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={`text-xxs font-semibold uppercase ${isPublished ? "text-info" : "text-muted-foreground"}`}>{isPublished ? "Published" : "Draft"}</span>
                  <span className="truncate text-xxs text-muted-foreground">{portfolio.pdf?.pages ?? 0} pages</span>
                </div>
                <div role="button" aria-label={`Edit ${portfolio.pdf?.name || "portfolio"}`} tabIndex={0} onClick={() => editPortfolio(portfolio.code)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); editPortfolio(portfolio.code); } }} className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <CatalogueCover blobKey={portfolio.pdf?.blobKey} />
                </div>
                <div className="pt-4">
                  <h3 className="truncate text-sm font-medium">{portfolio.pdf?.name?.replace(/\.pdf$/i, "") || portfolio.profile.name || "Untitled portfolio"}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{portfolio.username && personalActive(portfolio) ? `portfolia.site/${portfolio.username}` : `/p/${portfolio.code}`}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
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
          <AnalyticsPanel data={totalAnalytics(doc)} title="Total portfolio statistics" description="Combined visits and download clicks across all your portfolios. A browser viewing two portfolios counts as two visits and one estimated unique visitor." />
        </section>
        
        <details className="mt-6 max-w-2xl rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm">Send feedback or get help</summary><div className="mt-4"><FeedbackBox /></div></details>
      </main>
      <SiteFooter />

      <Modal open={dialog === "share"} onClose={() => setDialog(null)} title="Share portfolio">
        <ShareActions key={p.code} p={p} />
      </Modal>
      <UpgradeModal open={dialog === "upgrade"} onClose={() => setDialog(null)} />
      <Modal open={dialog === "limit"} onClose={() => setDialog(null)} title={paid ? "Portfolio limit reached" : "Upload another portfolio"}>
        {paid ? (
          <p className="text-muted-foreground">You have {all.length} of {MAX_PORTFOLIOS} portfolios, the most a Personal plan includes.</p>
        ) : (
          <>
            <p className="text-muted-foreground">The free plan includes one portfolio. Personal lets you keep up to {MAX_PORTFOLIOS}, each with its own link. Would you like to upgrade?</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="line" onClick={() => setDialog(null)}>Not now</Button>
              <Button onClick={() => setDialog("upgrade")}>See Personal plan</Button>
            </div>
          </>
        )}
      </Modal>
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
  // A quiet cover preview keeps the work more prominent than the card styling.
  return <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-background border border-border shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
    <div className="pointer-events-none h-full overflow-hidden bg-background" aria-hidden><PdfViewer source={src} fileName="" compact viewer={{ mode: "paged", look: "clean", background: "paper", finish: "matte", paper: "smooth", light: "soft", shadow: "none", thickness: "thin", spreads: "single", showHeader: false }} /></div>
  </div>;
}

function Confirm({ onCancel, onConfirm, label }: { onCancel: () => void; onConfirm: () => void; label: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button variant="line" onClick={onCancel}>Keep as is</Button>
      <Button onClick={onConfirm}>{label}</Button>
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
