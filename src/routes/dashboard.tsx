import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE, Modal, useBlob } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { PortfolioQrCode } from "@/components/pf/PortfolioQrCode";
import { Button } from "@/components/ui/button";
import { deleteBlob, formatBytes } from "@/lib/portfolia/assets";
import { sampleAnalytics } from "@/lib/portfolia/sample";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPortalUrl, keepSubscription, switchBilling } from "@/lib/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { submitFeedback } from "@/lib/feedback.functions";
import {
  allPortfolios, beginNewPortfolio, canAddPortfolio, isPaid, MAX_PORTFOLIOS, switchPortfolio,
  deletePortfolio, startPortfolio, graceEnds, GRACE_DAYS, patchPortfolio, personalActive, replacePdf, update, uploadLimitMb, useDoc,
  type Analytics, type PdfFile,
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
  const [dialog, setDialog] = useState<null | "replace" | "unpublish" | "delete" | "upgrade" | "cancel" | "qr">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { user, sub, loading, refresh } = useAccount();
  const keepFn = useServerFn(keepSubscription);
  const portal = useServerFn(getPortalUrl);
  const switchFn = useServerFn(switchBilling);
  const [billingBusy, setBillingBusy] = useState(false);
  const checkoutDone = typeof window !== "undefined" && window.location.search.includes("checkout=success");

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

  const all = allPortfolios(doc);
  const paid = isPaid(doc);
  const pdfLimitMb = uploadLimitMb(doc);
  const switcher = (all.length > 1 || paid) && (
    <nav aria-label="Your portfolios" className="mb-8 flex flex-wrap items-center gap-2">
      <span className="label-xs mr-1">Portfolios {all.length}/{MAX_PORTFOLIOS}</span>
      {all.map((x) => (
        <button key={x.code} onClick={() => switchPortfolio(x.code)} aria-current={x.code === p?.code ? "true" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-xs ${x.code === p?.code ? "border-foreground bg-card shadow-soft" : "border-border text-muted-foreground hover:border-border-strong"}`}>
          {x.profile.name || x.pdf?.name || "Untitled"}{x.status !== "published" && " · draft"}
        </button>
      ))}
      {!p && <span className="rounded-full border border-dashed border-foreground px-3.5 py-1.5 text-xs">New portfolio</span>}
      {p && (canAddPortfolio(doc)
        ? <Button size="xs" variant="line" onClick={() => beginNewPortfolio()}>+ New portfolio</Button>
        : paid && <span className="text-xs text-muted-foreground">You’ve reached {MAX_PORTFOLIOS} portfolios.</span>)}
    </nav>
  );

  if (!p) {
    return (
      <div className="min-h-screen">{header}
        <main className="shell max-w-[90rem] py-14">
          {switcher}
          <h1 className="display-title text-3xl">{all.length ? "Upload your next portfolio" : "No portfolio yet"}</h1>
          {all.length > 0 && <Button size="sm" variant="quiet" className="mt-3" onClick={() => switchPortfolio(all[0]!.code)}>Cancel</Button>}
          <div className="mt-6 max-w-2xl"><DropZone limitMb={pdfLimitMb} onAccepted={(pdf) => { if (startPortfolio(pdf)) void navigate({ to: "/create" }); }} /></div>
          <div className="mt-14"><AnalyticsPanel data={sampleAnalytics()} sample /></div>
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
  const published = p.status === "published";

  return (
    <div className="min-h-screen"><PaymentTestModeBanner />{header}
      <main className="shell max-w-[90rem] py-10">
        {switcher}
        <div className="grid gap-10 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-14">
          <div>
            <Thumb blobKey={p.pdf?.blobKey} />
            <p className="mt-3 text-sm font-medium">{p.profile.name}</p>
            <p className="text-xs text-muted-foreground">{p.pdf ? `${p.pdf.name} · ${p.pdf.pages} pages · ${formatBytes(p.pdf.bytes)}` : "No PDF"}</p>
          </div>

          <div className="space-y-10">
            <section>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="display-title text-3xl">{all.length > 1 ? p.profile.name || "Your portfolio" : "Your portfolio"}</h1>
                <span className={`rounded-full border px-2.5 py-0.5 text-xxs uppercase tracking-wider ${published ? "border-foreground" : "border-border text-muted-foreground"}`}>{published ? "Published · Unlisted" : "Not published"}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <code className="rounded-full border border-border px-3.5 py-1.5 text-xs select-all">{origin.replace(/^https?:\/\//, "")}{sharePath}</code>
                <Button size="sm" variant="line" onClick={() => void copy()}><Copy /> {copied ? "Copied" : "Copy link"}</Button>
                <Button size="sm" variant="line" onClick={() => setDialog("qr")}><QrCode /> QR code</Button>
                {published ? (
                  personalPath ? <Button size="sm" variant="line" asChild><Link to="/$username" params={{ username: p.username ?? "" }}><ExternalLink /> Open portfolio</Link></Button>
                    : <Button size="sm" variant="line" asChild><Link to="/p/$slug" params={{ slug: p.code }}><ExternalLink /> Open portfolio</Link></Button>
                ) : (
                  <Button size="sm" onClick={() => setMsg(patchPortfolio({ status: "published", publishedAt: Date.now() }) ? null : "Publishing failed — nothing changed.")}>Publish portfolio</Button>
                )}
                <Button size="sm" variant="quiet" asChild><Link to="/p/$slug" params={{ slug: p.code }} search={{ preview: "1" }}>Preview</Link></Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Anyone with your link can view. Your portfolio will not appear in a public directory. This is not password protection. Search indexing is off.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="line" onClick={() => setDialog("replace")}>Replace PDF</Button>
                <Button size="sm" variant="line" asChild><Link to="/create">Edit profile</Link></Button>
                {published && <Button size="sm" variant="line" onClick={() => setDialog("unpublish")}>Unpublish</Button>}
                <Button size="sm" variant="quiet" onClick={() => setDialog("delete")}>Delete portfolio</Button>
              </div>
              {msg && <p role="alert" className="mt-3 text-sm text-destructive">{msg}</p>}
            </section>

            <section className="rule-t pt-8">
              <h2 className="text-sm font-medium">Plan and address</h2>
              <p className="mt-2 text-sm">{p.plan === "personal" ? `Personal — billed ${p.billing === "month" ? "monthly" : "yearly"}` : "Free"}</p>
              {checkoutDone && !sub && <p role="status" className="mt-1 text-xs text-muted-foreground">Payment received — confirming your plan, this takes a few seconds…</p>}
              {sub?.cancel_at_period_end && sub.current_period_end && <p className="mt-1 text-xs text-muted-foreground">Cancelled. Personal stays active until {new Date(sub.current_period_end).toLocaleDateString()}, then your personalised address is kept for {GRACE_DAYS} more days.</p>}
              {sub?.status === "past_due" && <p role="alert" className="mt-1 text-xs text-destructive">Your last payment didn’t go through. Please update your card to keep Personal.</p>}
              <ul className="mt-2 space-y-1 text-sm">
                <li>Free address: <span className="font-mono text-xs">{freePath}</span> — always works</li>
                {p.username && (
                  <li>
                    Personalised: {active && published ? <Link to="/$username" params={{ username: p.username }} className="font-mono text-xs underline">portfolia.site/{p.username}</Link> : <span className="font-mono text-xs">portfolia.site/{p.username}</span>}
                  </li>
                )}
                {p.cancelledAt && active && <li className="text-xs text-muted-foreground">Cancelled. Personalised address stays active until {graceEnds(p)!.toLocaleDateString()}; the name won’t be reassigned straight away.</li>}
              </ul>
              <div className="mt-4 flex gap-2">
                {p.plan === "free" ? (
                  <Button size="sm" onClick={() => setDialog("upgrade")}>Get a personalised address</Button>
                ) : (
                  <>
                    <Button size="sm" variant="line" onClick={() => setDialog("upgrade")}>Change address</Button>
                    {sub && sub.status !== "canceled" && !sub.cancel_at_period_end && (
                      <Button size="sm" variant="line" disabled={billingBusy} onClick={async () => {
                        setBillingBusy(true); setMsg(null);
                        try { await switchFn({ data: { environment: getPaddleEnvironment(), priceId: p.billing === "month" ? "personal_yearly" : "personal_monthly" } }); setMsg("Billing switched. The difference has been charged or credited."); setTimeout(refresh, 3000); }
                        catch (e) { setMsg(`Couldn’t switch billing — nothing changed. ${e instanceof Error ? e.message : ""}`); }
                        finally { setBillingBusy(false); }
                      }}>Switch to {p.billing === "month" ? "yearly" : "monthly"}</Button>
                    )}
                    {sub && sub.status !== "canceled" && sub.cancel_at_period_end && (
                      <Button size="sm" disabled={billingBusy} onClick={async () => {
                        setBillingBusy(true); setMsg(null);
                        try { await keepFn({ data: { environment: getPaddleEnvironment() } }); setMsg("Your plan will renew as normal."); setTimeout(refresh, 3000); }
                        catch { setMsg("Couldn’t undo the cancellation — please try again."); }
                        finally { setBillingBusy(false); }
                      }}>Keep my plan</Button>
                    )}
                    {sub && sub.status !== "canceled" && <Button size="sm" variant="quiet" onClick={() => setDialog("cancel")}>{sub.status === "past_due" ? "Update card" : "Manage or cancel"}</Button>}
                  </>
                )}
              </div>
            </section>

            {!paid && (
              <section className="rule-t pt-8">
                <h2 className="text-sm font-medium">More portfolios</h2>
                <p className="mt-2 text-sm text-muted-foreground">The Personal plan lets you keep up to {MAX_PORTFOLIOS} portfolios, each with its own link, and add a CV to your details.</p>
                <Button size="sm" variant="line" className="mt-4" onClick={() => setDialog("upgrade")}>See Personal plan</Button>
              </section>
            )}
            <section className="rule-t pt-8"><AnalyticsPanel data={doc.analytics} /></section>
            <DemoNote>{LOCAL_NOTE}</DemoNote>
          </div>
        </div>
      </main>
      <SiteFooter />

      <ReplaceModal open={dialog === "replace"} onClose={() => setDialog(null)} current={p.pdf} limitMb={pdfLimitMb} />
      <PortfolioQrCode open={dialog === "qr"} onClose={() => setDialog(null)} url={origin + sharePath} name={p.profile.name} />
      <UpgradeModal open={dialog === "upgrade"} onClose={() => setDialog(null)} />
      <Modal open={dialog === "unpublish"} onClose={() => setDialog(null)} title="Unpublish portfolio?">
        <p className="text-muted-foreground">Visitors will see “No portfolio here” at your link. Your PDF, details and link are kept, so you can publish again later.</p>
        <Confirm onCancel={() => setDialog(null)} label="Unpublish" onConfirm={() => { setMsg(patchPortfolio({ status: "draft" }) ? null : "Couldn’t unpublish — nothing changed."); setDialog(null); }} />
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete portfolio?">
        <p className="text-muted-foreground">This permanently removes this portfolio’s PDF, details and statistics from your account. It can’t be undone.</p>
        <Confirm onCancel={() => setDialog(null)} label="Delete permanently" onConfirm={() => { void deletePortfolio(); setDialog(null); }} />
      </Modal>
      <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Cancel Personal?">
        <p className="text-muted-foreground">Every portfolio stays available at its free address (this one: {freePath}) — nothing is deleted. You won’t be able to add new portfolios and CVs are hidden from visitors. Personal stays active until the end of the period you’ve paid for, then your personalised address remains for {GRACE_DAYS} more days. The Portfolia credit returns after that. Cancelling, card details and invoices open in a secure billing page.</p>
        <Confirm onCancel={() => setDialog(null)} label="Open billing page" onConfirm={async () => { setDialog(null); const w = window.open("", "_blank"); try { const url = await portal({ data: { environment: getPaddleEnvironment() } }); if (w) w.location.href = url; else window.location.href = url; } catch { w?.close(); setMsg("Couldn’t open the billing page — try again."); } }} />
      </Modal>
    </div>
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

function Thumb({ blobKey }: { blobKey?: string }) {
  const blob = useBlob(blobKey);
  const src = useMemo(() => (blob ? { blob } : null), [blob]);
  return (
    <div className="h-80 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="pointer-events-none h-full overflow-hidden rounded-2xl" aria-hidden><PdfViewer source={src} fileName="" compact /></div>
    </div>
  );
}

function ReplaceModal({ open, onClose, current, limitMb }: { open: boolean; onClose: () => void; current: PdfFile | null; limitMb: number }) {
  const [next, setNext] = useState<PdfFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const blob = useBlob(next?.blobKey);
  const src = useMemo(() => (blob ? { blob } : null), [blob]);
  const close = () => {
    if (next) void deleteBlob(next.blobKey);
    setNext(null);
    setErr(null);
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Replace PDF">
      <p className="text-muted-foreground">Your link and profile stay the same. {current ? `The current PDF (${current.name}) stays published until you confirm.` : ""}</p>
      <div className="mt-4">
        {!next ? (
          <DropZone small label="Choose replacement PDF" limitMb={limitMb} onAccepted={setNext} />
        ) : (
          <>
            <p className="text-xs">{next.name} · {next.pages} pages · {formatBytes(next.bytes)}</p>
            <div className="mt-2 h-72 overflow-auto border border-border"><PdfViewer source={src} fileName={next.name} compact /></div>
            {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="line" onClick={close}>Cancel</Button>
              <Button onClick={async () => {
                if (!(await replacePdf(next))) return setErr("Couldn’t save — your current PDF is still published.");
                setNext(null);
                onClose();
              }}>Confirm replacement</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
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
