import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Download, ExternalLink, Globe, Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PrototypeNote } from "@/components/portfolia/SiteChrome";
import { exportPortfolio } from "@/lib/portfolia/exportArchive";
import { hasUnpublishedChanges, publish, unpublish, updatePortfolio } from "@/lib/portfolia/store";
import type { Portfolio, Visibility } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

const VISIBILITY: {
  id: Visibility;
  name: string;
  blurb: string;
  icon: typeof Lock;
}[] = [
  { id: "draft", name: "Draft", blurb: "Not published. Only you can see it.", icon: Lock },
  {
    id: "unlisted",
    name: "Unlisted",
    blurb: "Anyone with your link can view. Your portfolio will not appear in Explore.",
    icon: Link2,
  },
  {
    id: "discoverable",
    name: "Discoverable",
    blurb: "Included in Portfolia search and browsing.",
    icon: Globe,
  },
];

export function SharePanel({ portfolio }: { portfolio: Portfolio }) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const pending = hasUnpublishedChanges(portfolio);
  const address =
    typeof window === "undefined" ? `/p/${portfolio.slug}` : `${window.location.origin}/p/${portfolio.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-7">
      <section>
        <h3 className="text-sm font-medium">Portfolio address</h3>
        <div className="mt-2 flex gap-2">
          <Input readOnly value={address} className="font-mono text-xs" aria-label="Portfolio address" />
          <Button variant="line" size="icon" onClick={() => void copy()} aria-label="Copy link">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={portfolio.slug}
            onChange={(e) =>
              updatePortfolio(portfolio.id, (p) => {
                p.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) || p.slug;
              })
            }
            className="h-8 w-48 font-mono text-xs"
            aria-label="Address name"
          />
          <span className="text-xxs text-muted-foreground">the name in /p/&lt;name&gt;</span>
        </div>
        <p className="mt-2 text-xxs text-muted-foreground">
          The intended future format is <span className="font-mono">name.portfolia.com</span>, subject
          to domain ownership and configuration. This prototype uses local{" "}
          <span className="font-mono">/p/name</span> routes only — portfolia.com is not connected.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-medium">Who can see it</h3>
        <div className="mt-3 space-y-2">
          {VISIBILITY.map((v) => {
            const active = portfolio.visibility === v.id;
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() =>
                  v.id === "draft"
                    ? unpublish(portfolio.id)
                    : publish(portfolio.id, v.id as "unlisted" | "discoverable")
                }
                className={cn(
                  "flex w-full gap-3 border p-3 text-left transition-colors",
                  active ? "border-foreground" : "border-border hover:border-border-strong",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block text-sm">{v.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {v.blurb}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xxs text-muted-foreground">
          Unlisted means not listed. It is not access control or confidentiality — anyone holding the
          link can open it.
        </p>
      </section>

      <section className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="indexing" className="text-sm font-medium">
            Allow search engines to index
          </Label>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Off by default. Only available for discoverable portfolios. Keeping it off means your page
            is less likely to be listed by search engines — it does not stop anyone with the link from
            opening it.
          </p>
        </div>
        <Switch
          id="indexing"
          checked={portfolio.searchEngineIndexing}
          disabled={portfolio.visibility !== "discoverable"}
          onCheckedChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.searchEngineIndexing = v;
            })
          }
        />
      </section>

      <section className="rule-t pt-6">
        <h3 className="text-sm font-medium">Published status</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {portfolio.published
            ? `Last published ${new Date(portfolio.published.at).toLocaleString()}.`
            : "Never published."}{" "}
          {portfolio.published && pending
            ? "You have edits that visitors cannot see yet."
            : portfolio.published
              ? "Visitors are seeing your latest published version."
              : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => publish(portfolio.id, portfolio.visibility === "discoverable" ? "discoverable" : "unlisted")}>
            {portfolio.published ? "Publish changes" : "Publish (unlisted)"}
          </Button>
          <Button asChild variant="line">
            <Link to="/p/$slug" params={{ slug: portfolio.slug }} target="_blank">
              Visitor view <ExternalLink />
            </Link>
          </Button>
          <Button asChild variant="line">
            <Link
              to="/p/$slug"
              params={{ slug: portfolio.slug }}
              search={{ preview: "draft" }}
              target="_blank"
            >
              Preview draft
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-xxs text-muted-foreground">
          Publishing copies your draft into the published version. It never overwrites or flattens the
          draft you keep editing.
        </p>
      </section>

      <section className="rule-t pt-6">
        <h3 className="text-sm font-medium">Backup and export</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Download your content and layout data with every original file you uploaded, including source
          PDFs. It is a backup archive — not a ready-to-host website.
        </p>
        <Button
          variant="line"
          className="mt-3"
          disabled={exporting === "working"}
          onClick={async () => {
            setExporting("working");
            try {
              const r = await exportPortfolio(portfolio);
              setExporting(
                r.missing
                  ? `Archive downloaded. ${r.missing} file(s) could not be read from this browser's storage.`
                  : "Archive downloaded.",
              );
            } catch {
              setExporting("The archive could not be created. Your work is unchanged.");
            }
          }}
        >
          <Download /> Export archive (.zip)
        </Button>
        {exporting && exporting !== "working" && (
          <p className="mt-2 text-xs text-muted-foreground">{exporting}</p>
        )}
      </section>

      <PrototypeNote>
        Sharing is local to this browser. A link you send to someone else will open Portfolia on their
        device, but your uploaded files are not on a server, so they will not see your work.
      </PrototypeNote>
    </div>
  );
}
