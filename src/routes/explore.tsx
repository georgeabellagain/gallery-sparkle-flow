import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/portfolia/SiteChrome";
import { AssetImage } from "@/components/portfolia/AssetImage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDoc } from "@/lib/portfolia/store";
import { DISCIPLINES } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explore")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    d: typeof search.d === "string" && search.d ? search.d : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explore portfolios — Portfolia" },
      {
        name: "description",
        content: "Search creators and browse portfolios by discipline. Only portfolios opted into discovery appear here.",
      },
      { property: "og:title", content: "Explore portfolios — Portfolia" },
      { property: "og:description", content: "Browse discoverable portfolios by creative discipline." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const { q, d } = Route.useSearch();
  const navigate = useNavigate({ from: "/explore" });
  const doc = useDoc();

  const results = doc.portfolios.filter((p) => {
    if (p.visibility !== "discoverable" || !p.published) return false;
    if (d && p.discipline !== d) return false;
    if (!q) return true;
    const hay = [p.title, p.owner, p.tagline, p.discipline, ...p.projects.map((x) => x.title)]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const setSearch = (next: { q?: string; d?: string }) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }) });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Button asChild size="sm" variant="line">
            <Link to="/create">Create a portfolio</Link>
          </Button>
        }
      />
      <main className="flex-1">
        <div className="shell py-12">
          <h1 className="display-title text-4xl">Explore</h1>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">
            Only portfolios whose creators explicitly opted into discovery are listed here.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                defaultValue={q ?? ""}
                onChange={(e) => setSearch({ q: e.target.value || undefined })}
                placeholder="Search creators and work"
                aria-label="Search creators and work"
                className="h-10 w-full pl-9 sm:w-80"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={!d} onClick={() => setSearch({ d: undefined })}>
                All disciplines
              </FilterChip>
              {DISCIPLINES.filter((x) => x !== "Other").map((x) => (
                <FilterChip key={x} active={d === x} onClick={() => setSearch({ d: x })}>
                  {x}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <Link key={p.id} to="/p/$slug" params={{ slug: p.slug }} className="group">
                <div className="overflow-hidden bg-muted">
                  <AssetImage
                    assetId={p.projects[0]?.coverAssetId}
                    alt=""
                    className="aspect-4/3 w-full transition-transform duration-500 group-hover:scale-[1.015]"
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium">{p.title}</h2>
                  <span className="text-xxs text-muted-foreground">{p.discipline}</span>
                </div>
                {p.tagline && <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>}
                {p.isExample && <p className="label-xs mt-1">Example</p>}
              </Link>
            ))}
          </div>

          {!results.length && (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Nothing matches that yet.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full border px-3.5 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
