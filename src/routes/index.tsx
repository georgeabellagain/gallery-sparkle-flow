import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/portfolia/SiteChrome";
import { AssetImage } from "@/components/portfolia/AssetImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDoc } from "@/lib/portfolia/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portfolia — one link for your work" },
      {
        name: "description",
        content:
          "Upload a PDF or start from a blank canvas, choose how your work is experienced, and share one personal link.",
      },
      { property: "og:title", content: "Portfolia — one link for your work" },
      {
        property: "og:description",
        content: "Minimal portfolios for artists, designers, architects and photographers.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const doc = useDoc();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const examples = doc.portfolios.filter((p) => p.isExample).slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Button asChild size="sm">
            <Link to="/create">Create a portfolio</Link>
          </Button>
        }
      />

      <main className="flex-1">
        <section className="shell pt-20 pb-16 sm:pt-28">
          <h1 className="display-title max-w-3xl text-5xl text-balance sm:text-6xl">
            Upload or create your portfolio, choose how it is experienced, and share it through one
            link.
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Portfolia is a quiet home for visual work. No feeds, no likes, no noise — just your
            pages, presented the way you intended.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link to="/create">
                Create a portfolio <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="line">
              <Link to="/explore">Explore portfolios</Link>
            </Button>
            <form
              className="relative sm:ml-2"
              onSubmit={(e) => {
                e.preventDefault();
                void navigate({ to: "/explore", search: { q: q || undefined } });
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search creators and work"
                aria-label="Search creators and work"
                className="h-11 w-full pl-9 sm:w-72"
              />
            </form>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-14">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium">Example portfolios</h2>
              <Link to="/explore" className="text-xs text-muted-foreground hover:text-foreground">
                See all
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Demonstration content included with the prototype, not real client work.
            </p>

            <div className="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {examples.map((p) => (
                <Link key={p.id} to="/p/$slug" params={{ slug: p.slug }} className="group">
                  <div className="overflow-hidden bg-muted">
                    <AssetImage
                      assetId={p.projects[0]?.coverAssetId}
                      alt=""
                      className="aspect-3/4 w-full transition-transform duration-500 group-hover:scale-[1.015]"
                    />
                  </div>
                  <h3 className="mt-3 text-sm font-medium">{p.title}</h3>
                  <p className="text-xs text-muted-foreground">{p.discipline}</p>
                  <p className="label-xs mt-1">Example</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell grid gap-10 py-14 sm:grid-cols-3">
            {[
              {
                t: "Start from what you have",
                d: "Bring an existing PDF and keep every page exactly as you designed it, or begin with a genuinely blank canvas.",
              },
              {
                t: "Five ways to be seen",
                d: "Paged, continuous scroll, grid, masonry or a page-turn book. Switch freely — your content is never rearranged behind your back.",
              },
              {
                t: "One link, your terms",
                d: "Publish unlisted by default. Opt into Explore only when you want to be found.",
              },
            ].map((c) => (
              <div key={c.t}>
                <h3 className="text-sm font-medium">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
