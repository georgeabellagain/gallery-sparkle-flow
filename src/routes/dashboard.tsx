import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { SiteFooter, SiteHeader, PrototypeNote } from "@/components/portfolia/SiteChrome";
import { AssetImage } from "@/components/portfolia/AssetImage";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  hasUnpublishedChanges,
  myPortfolios,
  resetPrototypeData,
  restoreTrash,
  storageUsed,
  useDoc,
} from "@/lib/portfolia/store";
import { formatBytes } from "@/lib/portfolia/assets";
import { LAYOUTS } from "@/lib/portfolia/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your workspace — Portfolia" },
      {
        name: "description",
        content: "Your portfolios, drafts, storage use and recently deleted items.",
      },
      { property: "og:title", content: "Your workspace — Portfolia" },
      { property: "og:description", content: "A quiet workspace: portfolios, drafts and storage." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const doc = useDoc();
  const mine = myPortfolios(doc);
  const used = storageUsed(doc);
  const allowance = doc.storageAllowanceMb * 1024 * 1024;
  const trash = doc.trash;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Button asChild size="sm">
            <Link to="/create">
              <Plus /> Create portfolio
            </Link>
          </Button>
        }
      />
      <main className="flex-1">
        <div className="shell py-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-title text-4xl">Workspace</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Demo creator account — no sign-in required in this prototype.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="flex items-baseline justify-between text-xs">
                <span className="label-xs">Storage</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatBytes(used)} of {doc.storageAllowanceMb} MB
                </span>
              </div>
              <Progress value={Math.min(100, (used / allowance) * 100)} className="mt-2 h-1" />
              <p className="mt-2 text-xxs text-muted-foreground">
                Counts your uploads in this browser. Example portfolios don’t count.
              </p>
            </div>
          </div>

          <section className="mt-12">
            <h2 className="text-sm font-medium">Your portfolios</h2>
            {!mine.length ? (
              <div className="mt-4 border border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing here yet. Bring a PDF or start from a blank canvas.
                </p>
                <Button asChild className="mt-5">
                  <Link to="/create">Create portfolio</Link>
                </Button>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border rule-t rule-b">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 py-4">
                    <div className="h-14 w-20 shrink-0 overflow-hidden bg-muted">
                      <AssetImage
                        assetId={p.projects[0]?.coverAssetId}
                        alt=""
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/editor/$id"
                          params={{ id: p.id }}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {p.title}
                        </Link>
                        <StatusTag p={p} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.projects.length} project{p.projects.length === 1 ? "" : "s"} ·{" "}
                        {LAYOUTS.find((l) => l.id === p.defaultLayout)?.name} · edited{" "}
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {p.published && (
                        <Button asChild size="xs" variant="line">
                          <Link to="/p/$slug" params={{ slug: p.slug }}>
                            View
                          </Link>
                        </Button>
                      )}
                      <Button asChild size="xs">
                        <Link to="/editor/$id" params={{ id: p.id }}>
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Trash2 className="size-3.5" /> Recently deleted
            </h2>
            {!trash.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nothing deleted. Removed items stay here until you empty them.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rule-t rule-b">
                {trash.slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="truncate">{t.label}</span>
                    <Button size="xs" variant="line" onClick={() => restoreTrash(t.id)}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-14 max-w-2xl space-y-4">
            <PrototypeNote>
              Everything here lives in this browser profile. Publishing makes a portfolio viewable at
              a local prototype address — another person opening that link on their own device will
              not see your uploads.
            </PrototypeNote>
            <Button
              variant="line"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Remove all prototype data from this browser? Your portfolios, uploads and versions will be deleted.",
                  )
                )
                  resetPrototypeData();
              }}
            >
              Reset prototype data
            </Button>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusTag({ p }: { p: { visibility: string; published?: unknown } & Parameters<typeof hasUnpublishedChanges>[0] }) {
  const label =
    p.visibility === "draft" ? "Draft" : p.visibility === "unlisted" ? "Unlisted" : "Discoverable";
  const pending = p.published && hasUnpublishedChanges(p);
  return (
    <span className="flex items-center gap-2">
      <span className="border border-border px-1.5 py-0.5 text-xxs text-muted-foreground">{label}</span>
      {pending && <span className="text-xxs text-muted-foreground">unpublished edits</span>}
    </span>
  );
}
