import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { SiteHeader, DemoNote, LOCAL_NOTE, Modal, useBlob } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { deleteBlob, formatBytes } from "@/lib/portfolia/assets";
import { sampleAnalytics } from "@/lib/portfolia/sample";
import {
  deletePortfolio, startPortfolio, graceEnds, GRACE_DAYS, patchPortfolio, personalActive, replacePdf, update, useDoc,
  type Analytics, type PdfFile,
} from "@/lib/portfolia/store";

export const Route = createFileRoute("/dashboard")({
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
  const [dialog, setDialog] = useState<null | "replace" | "unpublish" | "delete" | "upgrade" | "cancel">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!hydrated) return null;

  const header = (
    <SiteHeader
      right={
        <>
          <span className="hidden text-xs text-muted-foreground sm:inline">Demo account</span>
          {doc.account.signedIn && (
            <button className="text-sm hover:underline underline-offset-4" onClick={() => { update((d) => ({ ...d, account: { signedIn: false } })); void navigate({ to: "/" }); }}>Sign out</button>
          )}
        </>
      }
    />
  );

  if (!doc.account.signedIn) {
    return (
      <div className="min-h-screen">{header}
        <main className="mx-auto max-w-md px-5 py-24 text-center text-sm">
          <p>Sign in with the demo account to see your dashboard.</p>
          <Button asChild className="mt-4"><Link to="/signin">Sign in</Link></Button>
        </main>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen">{header}
        <main className="shell py-14">
          <h1 className="display-title text-3xl">No portfolio yet</h1>
          <div className="mt-6 max-w-lg"><DropZone onAccepted={(pdf) => { if (startPortfolio(pdf)) void navigate({ to: "/create" }); }} /></div>
          <div className="mt-14 max-w-3xl"><AnalyticsPanel data={sampleAnalytics()} sample /></div>
        </main>
      </div>
    );
  }

  const freePath = `/p/${p.code}`;
  const active = personalActive(p);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(origin + freePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Couldn’t copy automatically — select the address and copy it manually.");
    }
  };
  const published = p.status === "published";

  return (
    <div className="min-h-screen">{header}
      <main className="shell py-10">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <Thumb blobKey={p.pdf?.blobKey} />
            <p className="mt-3 text-sm font-medium">{p.profile.name}</p>
            <p className="text-xs text-muted-foreground">{p.pdf ? `${p.pdf.name} · ${p.pdf.pages} pages · ${formatBytes(p.pdf.bytes)}` : "No PDF"}</p>
          </div>

          <div className="space-y-10">
            <section>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="display-title text-3xl">Your portfolio</h1>
                <span className={`border px-2 py-0.5 text-xxs uppercase tracking-wider ${published ? "border-foreground" : "border-border text-muted-foreground"}`}>{published ? "Published · Unlisted" : "Not published"}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <code className="border border-border px-2.5 py-1.5 text-xs select-all">{origin.replace(/^https?:\/\//, "")}{freePath}</code>
                <Button size="sm" variant="line" onClick={() => void copy()}><Copy /> {copied ? "Copied" : "Copy link"}</Button>
                {published ? (
                  <Button size="sm" variant="line" asChild><Link to="/p/$slug" params={{ slug: p.code }}><ExternalLink /> Open portfolio</Link></Button>
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
              <p className="mt-2 text-sm">{p.plan === "personal" ? `Personal (demo) — billed ${p.billing === "month" ? "monthly" : "yearly"}` : "Free"}</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>Free address: <span className="font-mono text-xs">{freePath}</span> — always works</li>
                {p.username && (
                  <li>
                    Personalised: <span className="font-mono text-xs">{p.username}.portfolia.com</span> <span className="text-xs text-muted-foreground">(preview — opens locally at </span>
                    {active && published ? <Link to="/u/$username" params={{ username: p.username }} className="font-mono text-xs underline">/u/{p.username}</Link> : <span className="font-mono text-xs">/u/{p.username}</span>}
                    <span className="text-xs text-muted-foreground">)</span>
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
                    <Button size="sm" variant="quiet" onClick={() => setDialog("cancel")}>Cancel Personal</Button>
                  </>
                )}
              </div>
            </section>

            <section className="rule-t pt-8"><AnalyticsPanel data={doc.analytics} /></section>
            <DemoNote>{LOCAL_NOTE}</DemoNote>
          </div>
        </div>
      </main>

      <ReplaceModal open={dialog === "replace"} onClose={() => setDialog(null)} current={p.pdf} />
      <UpgradeModal open={dialog === "upgrade"} onClose={() => setDialog(null)} />
      <Modal open={dialog === "unpublish"} onClose={() => setDialog(null)} title="Unpublish portfolio?">
        <p className="text-muted-foreground">Visitors will see “No portfolio here” at your link. Your PDF, details and link are kept, so you can publish again later.</p>
        <Confirm onCancel={() => setDialog(null)} label="Unpublish" onConfirm={() => { setMsg(patchPortfolio({ status: "draft" }) ? null : "Couldn’t unpublish — nothing changed."); setDialog(null); }} />
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete portfolio?">
        <p className="text-muted-foreground">This removes your PDF, details and statistics from this browser. It can’t be undone.</p>
        <Confirm onCancel={() => setDialog(null)} label="Delete permanently" onConfirm={() => { void deletePortfolio(); setDialog(null); }} />
      </Modal>
      <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Cancel Personal (demo)?">
        <p className="text-muted-foreground">Your portfolio stays available at its free address {freePath}. Your personalised address remains active for {GRACE_DAYS} days, and the name isn’t reassigned immediately. The Portfolia credit returns.</p>
        <Confirm onCancel={() => setDialog(null)} label="Cancel plan" onConfirm={() => { setMsg(patchPortfolio({ plan: "free", cancelledAt: Date.now() }) ? null : "Couldn’t save — plan unchanged."); setDialog(null); }} />
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
    <div className="h-80 overflow-hidden border border-border">
      <div className="pointer-events-none h-full overflow-hidden" aria-hidden><PdfViewer source={src} fileName="" compact /></div>
    </div>
  );
}

function ReplaceModal({ open, onClose, current }: { open: boolean; onClose: () => void; current: PdfFile | null }) {
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
          <DropZone small label="Choose replacement PDF" onAccepted={setNext} />
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
        <h2 className="text-sm font-medium">Visit statistics {sample && <span className="ml-2 border border-border px-1.5 py-0.5 text-xxs uppercase tracking-wider text-muted-foreground">Sample data — example portfolio</span>}</h2>
        <div role="group" aria-label="Time range" className="flex text-xs">
          {([[7, "7 days"], [30, "30 days"], [0, "All time"]] as const).map(([r, l]) => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={`border px-2.5 py-1 -ml-px ${range === r ? "border-foreground" : "border-border text-muted-foreground"}`}>{l}</button>
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
        {!sample && " In this prototype, only visits from this browser are counted."}
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
