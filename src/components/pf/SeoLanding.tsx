import { PROFESSION_GUIDES, withProfessionContent } from "@/lib/portfolia/profession-guides";
import { ProfessionExample } from "./ProfessionExample";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { SEO_LINKS } from "@/lib/portfolia/seo-pages";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";

export interface SeoContent {
  path: string;
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
  const image = guide && guide.kind !== "fashion" ? `https://portfolia.site/examples/${guide.kind}-social.jpg` : "https://portfolia.site/og-image.jpg";
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

export function SeoLanding({ c: base, children }: { c: SeoContent; children?: React.ReactNode }) {
  const c = withProfessionContent(base);
  const guide = PROFESSION_GUIDES[c.path];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Link to="/signin" className="hover:underline underline-offset-4">
            Sign in
          </Link>
        }
      />
      <main className="flex-1">
        <section className="shell max-w-4xl pt-16 pb-14 sm:pt-24">
          <h1 className="display-title text-4xl leading-[1.08] sm:text-5xl">
            {c.h1} <em className="italic">{c.h1Accent}</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {c.intro}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/"
              hash="upload"
              className="group inline-flex items-center gap-3 rounded-full bg-leaf py-3 pl-6 pr-3 text-sm font-medium text-background shadow-lift transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Upload your PDF free
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/20">
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
            {guide ? <a href="#profession-example" className="text-sm underline underline-offset-4">Explore the {guide.kind.replaceAll("-", " ")} example</a> : (
            <Link
              to="/p/$slug"
              params={{ slug: "sample" }}
              search={{ demo: "book" }}
              className="text-sm underline underline-offset-4"
            >
              Try the PDF flipbook
            </Link>
            )}
          </div>
        </section>

        {children}
        {guide ? <ProfessionExample guide={guide} /> : <section className="rule-t">
          <div className="shell grid max-w-4xl items-center gap-6 py-10 sm:grid-cols-2">
            <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="flex aspect-[4/3] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-[#02011e] p-8 text-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              <span className="display-title text-3xl">Scarlett Bushell</span>
              <span className="text-sm">Open the 14-page fashion lookbook →</span>
              <span className="text-xs text-white/70">Property of Scarlett Bushell 2026</span>
            </Link>
            <div>
              <h2 className="text-lg font-medium">See a portfolio before uploading yours</h2>
              <p className="mt-3 text-sm text-muted-foreground">Explore Scarlett Bushell’s fashion lookbook in the live viewer. Try the Simple and Studio appearances before sharing your own work.</p>
              <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="mt-4 inline-block text-sm underline underline-offset-4">Open the example portfolio</Link>
            </div>
          </div>
        </section>}

        <section className="rule-t">
          <div className="shell grid max-w-5xl gap-5 py-14 sm:grid-cols-3">
            {c.points.map((p) => (
              <div
                key={p.title}
                className="rounded-3xl border border-border bg-card p-6 shadow-soft"
              >
                <h2 className="text-base font-medium">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {guide && <section className="rule-t"><div className="shell max-w-4xl space-y-9 py-14">
          {guide.sections.map(section => <article key={section.title}><h2 className="display-title text-2xl">{section.title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{section.body}</p></article>)}
          <div className="rounded-2xl border border-border bg-card p-6"><h2 className="text-base font-medium">Before you share</h2><ul className="mt-4 space-y-3 text-sm">{guide.checklist.map(item=><li key={item} className="flex gap-3"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-leaf"/>{item}</li>)}</ul><p className="mt-5 text-sm"><Link to="/portfolio-checker" className="underline underline-offset-4">Check your PDF locally</Link> before uploading, or explore our <Link to="/embed-flipbook-in-squarespace" className="underline underline-offset-4">website embedding guide</Link>.</p></div>
        </div></section>}

        <section className="rule-t">
          <div className="shell max-w-4xl py-14">
            <h2 className="text-lg font-medium">A simple viewer for a professional presentation</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Choose scroll, page-by-page or PDF flipbook reading. The flipbook offers a clean
              Simple view and a 3D Studio view with paper finishes, room lighting and wood
              backdrops. On phones, the book camera follows the current page.
            </p>
            <p className="mt-3 text-sm">
              Start free with one PDF up to 10 MB.{" "}
              <a href="/free-pdf-flipbook" className="underline underline-offset-4">
                Explore the free PDF flipbook
              </a>{" "}
              or{" "}
              <a href="/issuu-alternative" className="underline underline-offset-4">
                learn about Portfolia as an Issuu alternative
              </a>
              .
            </p>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell max-w-4xl py-14">
            <h2 className="text-sm font-medium">How it works</h2>
            <ol className="mt-5 space-y-3 text-sm">
              {c.steps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-xs font-medium text-leaf">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <ul className="mt-8 space-y-1.5 text-sm">
              {[
                "Free plan: one PDF portfolio up to 10 MB",
                "Permanent sharing link and downloadable QR code",
                "Profile, email, LinkedIn and contact links",
                "Basic visit statistics",
              ].map((i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />
                  {i}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Need more? See{" "}
              <Link to="/pricing" className="underline underline-offset-4">
                pricing
              </Link>{" "}
              for the Personal plan.
            </p>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell max-w-4xl py-14">
            <h2 className="text-sm font-medium">Questions</h2>
            <dl className="mt-5 space-y-5">
              {c.faqs.map((f) => (
                <div key={f.q}>
                  <dt className="text-sm font-medium">{f.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
            <nav aria-label="Related guides" className="mt-10 flex flex-wrap gap-2">
              {OTHERS.filter((o) => o.to !== c.path).map((o) => (
                <a
                  key={o.to}
                  href={o.to}
                  className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-accent"
                >
                  {o.label}
                </a>
              ))}
            </nav>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

