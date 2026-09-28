import { Link, useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { PortfolioView } from "./PortfolioView";
import { Wordmark } from "./SiteChrome";
import { Button } from "@/components/ui/button";
import { snapshotOf, usePortfolioBySlug } from "@/lib/portfolia/store";

/**
 * The visitor-facing page at /p/<name>. Visitors see the last *published*
 * snapshot; the creator can append ?preview=draft to check unpublished edits.
 */
export function PublishedPage({
  slug,
  projectId,
  about,
  preview,
}: {
  slug: string;
  projectId?: string | null;
  about?: boolean;
  preview?: string;
}) {
  const portfolio = usePortfolioBySlug(slug);
  const navigate = useNavigate();

  if (!portfolio) {
    return (
      <Missing
        title="No portfolio at this address"
        body="This prototype address doesn’t exist in this browser. Portfolios are stored locally, so a link created on another device won’t open here."
      />
    );
  }

  const draftPreview = preview === "draft";
  const snapshot = draftPreview ? snapshotOf(portfolio) : portfolio.published?.snapshot;

  if (!snapshot || (portfolio.visibility === "draft" && !draftPreview)) {
    return (
      <Missing
        title="Not published yet"
        body="The creator hasn’t published this portfolio. Draft work is never shown to visitors."
        slug={slug}
      />
    );
  }

  return (
    <div className="min-h-screen">
      {draftPreview && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-5 py-2 text-xs">
          <span className="flex items-center gap-2">
            <Eye className="size-3.5" /> Draft preview — this is your unpublished working version.
            Visitors still see{" "}
            {portfolio.published
              ? `the version published ${new Date(portfolio.published.at).toLocaleString()}`
              : "nothing, because you haven’t published yet"}
            .
          </span>
          <Button asChild size="xs" variant="line">
            <Link to="/editor/$id" params={{ id: portfolio.id }}>
              Back to editor
            </Link>
          </Button>
        </div>
      )}
      <PortfolioView
        portfolio={portfolio}
        snapshot={snapshot}
        initialProjectId={projectId ?? undefined}
        initialAbout={about}
        onProjectChange={(id) => {
          if (id) void navigate({ to: "/p/$slug/$projectId", params: { slug, projectId: id } });
          else void navigate({ to: "/p/$slug", params: { slug } });
        }}
      />
    </div>
  );
}

function Missing({ title, body, slug }: { title: string; body: string; slug?: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="shell flex h-14 items-center rule-b">
        <Wordmark />
      </div>
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="max-w-md py-24 text-center">
          <h1 className="display-title text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
          {slug && <p className="mt-4 font-mono text-xs text-muted-foreground">/p/{slug}</p>}
          <Button asChild variant="line" className="mt-7">
            <Link to="/explore">Explore portfolios</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
