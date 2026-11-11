import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { MarketingHeader, SiteFooter } from "@/components/pf/Chrome";
import { LandingExampleProvider, LandingHero } from "@/components/pf/LandingHero";
import { useHeroExample, type HeroExample } from "@/components/pf/landing-example-context";
import { MarketingImage } from "@/components/pf/Media";
import { marketingAsset } from "@/lib/portfolia/marketing-assets";
import { PROFESSION_GUIDES } from "@/lib/portfolia/profession-guides";
import { PORTFOLIO_TICKS } from "@/lib/portfolia/landing-demo";

const TITLE = "Examples — PDF portfolios and digital products on Portfolia";
const DESCRIPTION = "Open real Portfolia books in the live viewer: a fashion lookbook, three demonstration portfolios, the Field Notes book and a digital product preview.";
const URL = "https://portfolia.site/examples";

export const Route = createFileRoute("/examples")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://portfolia.site/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: TITLE, url: URL, description: DESCRIPTION }) }],
  }),
  component: Examples,
});

type Example = {
  key: string; title: string; kind: string; disclosure: string; asset: string;
  cover?: { src: string; width: number; height: number }; tone?: string;
  open: HeroExample;
};

const guide = (path: string) => PROFESSION_GUIDES[path]!;
const profession = (path: string, kind: string, label: string): Example => ({
  key: kind, title: guide(path).exampleTitle, kind: `${label} demonstration portfolio`, disclosure: guide(path).disclosure, asset: `example-${kind}`,
  cover: { src: `/examples/${kind}-cover.webp`, width: 720, height: 912 },
  open: { url: `/examples/${kind}.pdf`, fileName: `${kind}-demonstration.pdf` },
});

// Every example is real Portfolia output. Demonstration portfolios stay labelled as such (owner decision 4, default).
const EXAMPLES: Example[] = [
  { key: "fashion", title: "Scarlett Bushell’s lookbook", kind: "Fashion lookbook", disclosure: "Property of Scarlett Bushell 2026", asset: "example-fashion", tone: "bg-[#02011e] text-white", open: { demo: "portfolio" } },
  profession("/architecture-portfolio", "architecture", "Architecture"),
  profession("/graphic-design-portfolio", "graphic-design", "Graphic design"),
  profession("/photography-portfolio", "photography", "Photography"),
  { key: "field-notes", title: "Field Notes", kind: "Portfolia’s own example book", disclosure: "Made by Portfolia to show its features: each page explains one.", asset: "example-field-notes", tone: "bg-[#dfe7d6] text-[#26352f]", open: { url: "/examples/field-notes/field-notes.pdf", fileName: "field-notes.pdf", projects: false } },
  { key: "pink", title: "Pink", kind: "Digital product preview", disclosure: "A children’s book sold on Etsy. This is its public shop preview; the Buy link opens the real listing.", asset: "example-pink", tone: "bg-[#f3d6dc] text-[#5a2333]", open: { demo: "product" } },
];

function ExampleCard({ e }: { e: Example }) {
  const hero = useHeroExample();
  const picture = marketingAsset(e.asset);
  return <article className="flex flex-col">
    <div className="aspect-[600/760] overflow-hidden rounded-3xl bg-[#e9e8df] shadow-soft">
      {picture ? <MarketingImage name={e.asset} sizes="(min-width: 1024px) 360px, 50vw" className="h-full w-full object-cover" />
        : e.cover ? <img src={e.cover.src} width={e.cover.width} height={e.cover.height} alt={`${e.title}, ${e.kind.toLowerCase()} cover`} loading="lazy" className="h-full w-full object-contain" />
        : <span className={`flex h-full flex-col items-center justify-center gap-2 p-6 text-center ${e.tone ?? ""}`}><span className="display-title text-3xl">{e.title}</span><span className="text-xs opacity-75">{e.kind}</span></span>}
    </div>
    <h2 className="mt-4 text-base font-medium">{e.title}</h2>
    <p className="text-sm text-muted-foreground">{e.kind}</p>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{e.disclosure}</p>
    <button type="button" onClick={() => hero?.showExample(e.open)} className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium underline underline-offset-4">
      <ArrowUp aria-hidden className="size-4" />Open {e.title}
    </button>
  </article>;
}

function Examples() {
  return <LandingExampleProvider>
    <div className="flex min-h-screen flex-col">
      <MarketingHeader uploadHere />
      <main className="flex-1">
        <LandingHero
          eyebrow="Examples"
          heading={<>Real books, <em>in the real viewer.</em></>}
          intro="Every example below opens up here, in the same viewer your readers will use. Then try your own PDF."
          demo="portfolio"
          upload="portfolio"
          ticks={PORTFOLIO_TICKS}
        />
        <section className="rule-t">
          <div className="shell max-w-6xl py-16 sm:py-24">
            <h2 className="display-title text-3xl sm:text-4xl">Choose an example</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">One opens at a time, at the top of the page.</p>
            <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{EXAMPLES.map(e => <ExampleCard key={e.key} e={e} />)}</div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  </LandingExampleProvider>;
}
