import { LandingHero, LandingExampleProvider } from "./LandingHero";
import { LandingUploadBar } from "./LandingUploadBar";
import { HowItWorks } from "./HomeSections";
import { PointVisual, ViewerModes } from "./SeoSections";
import { HERO_INTRO_MAX_CHARS, heroDemoFor, landingCopy, relatedGuides } from "@/lib/portfolia/landing-demo";
import { PROFESSION_GUIDES, withProfessionContent } from "@/lib/portfolia/profession-guides";
import { ProfessionExample } from "./ProfessionExample";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SEO_LINKS } from "@/lib/portfolia/seo-pages";
import { ogImageUrl } from "@/lib/portfolia/marketing-assets";
import { MarketingHeader, SiteFooter } from "@/components/pf/Chrome";

export interface SeoContent {
  path: string;
  sections?: { title: string; body: string }[];
  checklist?: string[];
  title: string;
  description: string;
  h1: string;
  h1Accent: string;
  intro: string;
  points: { title: string; body: string }[];
  steps: string[];
  faqs: { q: string; a: string }[];
}

export function seoHead(base: SeoContent) {
  const c = withProfessionContent(base);
  const guide = PROFESSION_GUIDES[c.path];
  const image = guide && guide.kind !== "fashion" ? `https://portfolia.site/examples/${guide.kind}-social.jpg` : ogImageUrl("og-home", "https://portfolia.site/og-image.jpg");
  const url = `https://portfolia.site${c.path}`;
  return {
    meta: [
      { title: c.title },
      { name: "description", content: c.description },
      { property: "og:title", content: c.title },
      { property: "og:description", content: c.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Portfolia" },
      { property: "og:image", content: image },
      { property: "og:image:alt", content: guide ? `${guide.kind.replaceAll("-", " ")} portfolio example on Portfolia` : "Portfolia PDF portfolio hosting" },
      { name: "twitter:title", content: c.title },
      { name: "twitter:description", content: c.description },
      { name: "twitter:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      ...(c.faqs.length ? [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }).replace(/</g, "\\u003c"),
      }] : []),
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: c.title,
          url,
          description: c.description,
          isPartOf: { "@type": "WebSite", name: "Portfolia", url: "https://portfolia.site/" },
        }),
      },
    ],
  };
}

const OTHERS = SEO_LINKS;

/**
 * Every landing page opens with LandingHero: heading, intro, the upload box and a live example (plan 3).
 * heroArt is the page's own illustration; it sits beside the full introduction in the first section below the hero.
 * hideDefaultExample is kept so existing pages still compile; the "see a portfolio" block it once hid is gone.
 */
export function SeoLanding({ c: base, children, heroArt, uploadLabel, after }: { c: SeoContent; children?: React.ReactNode; hideDefaultExample?: boolean; heroArt?: React.ReactNode; uploadLabel?: string; after?: React.ReactNode }) {
  const c = withProfessionContent(base);
  const guide = PROFESSION_GUIDES[c.path];
  const demo = heroDemoFor(c.path), copy = landingCopy(c.path);
  return (
    <LandingExampleProvider>
    <div className="flex min-h-screen flex-col">
      <MarketingHeader uploadHere />
      <main className="flex-1">
        <LandingHero
          eyebrow={copy.eyebrow}
          heading={<>{c.h1} <em className="italic">{c.h1Accent}</em></>}
          intro={c.intro}
          demo={demo}
          upload="portfolio"
          uploadLabel={uploadLabel}
          ticks={copy.ticks}
          secondary={guide ? <a href="#profession-example" className="text-sm underline underline-offset-4">Explore the {guide.kind.replaceAll("-", " ")} example</a> : undefined}
        />
        <LandingUploadBar name={c.title.split("|")[0]!.trim()} />

        {/* The hero keeps the introduction to two lines; the whole of it is printed here, beside the page's artwork. */}
        {(heroArt || c.intro.length > HERO_INTRO_MAX_CHARS) && <section className="rule-t">
          <div className={heroArt ? "shell grid max-w-6xl items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr]" : "shell max-w-4xl py-10"}>
            <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{c.intro}</p>
            {heroArt}
          </div>
        </section>}

        {children}
        {guide && <ProfessionExample guide={guide} />}

        <section className="rule-t">
          <div className="shell grid max-w-6xl gap-5 py-16 sm:grid-cols-3 sm:py-24">
            {c.points.map((p) => (
              <div key={p.title} className="rounded-2xl border border-border bg-card p-6">
                <PointVisual title={p.title} body={p.body} cover={guide && guide.kind !== "fashion" ? `/examples/${guide.kind}-cover.webp` : undefined} />
                <h2 className="text-base font-medium">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {(guide || c.sections?.length) && <section className="rule-t"><div className="shell max-w-4xl space-y-12 py-16 sm:py-24">
          {(guide?.sections ?? c.sections ?? []).map(section => <article key={section.title}><h2 className="display-title text-3xl sm:text-4xl">{section.title}</h2><p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{section.body}</p></article>)}
          <div className="rounded-2xl border border-border bg-card p-6"><h2 className="text-base font-medium">Before you share</h2><ul className="mt-4 space-y-3 text-sm">{(guide?.checklist ?? c.checklist ?? []).map(item=><li key={item} className="flex gap-3"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-leaf"/>{item}</li>)}</ul><p className="mt-5 text-sm"><Link to="/portfolio-checker" className="underline underline-offset-4">Check your PDF locally</Link> before uploading, or explore our <Link to="/embed-flipbook-in-squarespace" className="underline underline-offset-4">website embedding guide</Link>.</p></div>
        </div></section>}

        <ViewerModes />

        <HowItWorks steps={c.steps} title="How it works" id="seo-steps" />

        {after}

        <section className="rule-t">
          <div className="shell max-w-4xl py-16 sm:py-24">
            <h2 className="display-title text-3xl sm:text-4xl">Questions</h2>
            <dl className="mt-8 space-y-6">
              {c.faqs.map((f) => (
                <div key={f.q}>
                  <dt className="text-base font-medium">{f.q}</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
            <nav aria-label="Related guides" className="mt-12 flex flex-wrap gap-2">
              {relatedGuides(c.path, OTHERS).map((o) => (
                <a key={o.to} href={o.to} className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-accent">{o.label}</a>
              ))}
              <a href="/guides" className="rounded-full px-4 py-1.5 text-xs font-medium underline underline-offset-4">All guides</a>
            </nav>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
    </LandingExampleProvider>
  );
}
