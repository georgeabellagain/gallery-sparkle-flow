import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, SiteFooter } from "@/components/pf/Chrome";
import { guideIndex } from "@/lib/portfolia/guide-index";

const TITLE = "All guides — PDF portfolios, flipbooks and digital products | Portfolia";
const DESCRIPTION = "Every Portfolia guide in one place: portfolios by discipline, sharing and hosting a PDF, embedding, selling digital products and comparisons.";
const URL = "https://portfolia.site/guides";

export const Route = createFileRoute("/guides")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Guides,
});

function Guides() {
  return <div className="flex min-h-screen flex-col">
    <MarketingHeader />
    <main className="flex-1">
      <section className="shell max-w-6xl py-16 sm:py-24">
        <p className="label-xs">Guides</p>
        <h1 className="display-title mt-3 text-4xl sm:text-5xl">Every guide, in one place.</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">Pick the one closest to what you want to do. Each opens with an upload box, so you can try your own PDF straight away.</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {guideIndex().map(g => <nav key={g.family} aria-label={g.title}>
            <h2 className="text-base font-medium">{g.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">{g.links.map(l => <li key={l.to}><a href={l.to} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{l.label}</a></li>)}</ul>
          </nav>)}
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
