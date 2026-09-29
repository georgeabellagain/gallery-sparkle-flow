import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
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

export function seoHead(c: SeoContent) {
  const url = `https://portfolia.site${c.path}`;
  return {
    meta: [
      { title: c.title },
      { name: "description", content: c.description },
      { property: "og:title", content: c.title },
      { property: "og:description", content: c.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
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

const OTHERS = [
  { to: "/free-pdf-portfolio", label: "Free PDF portfolio hosting" },
  { to: "/free-portfolio-website", label: "Free portfolio website" },
  { to: "/architecture-portfolio", label: "Architecture portfolio website" },
] as const;

export function SeoLanding({ c }: { c: SeoContent }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader right={<Link to="/signin" className="hover:underline underline-offset-4">Sign in</Link>} />
      <main className="flex-1">
        <section className="shell max-w-4xl pt-16 pb-14 sm:pt-24">
          <h1 className="display-title text-4xl leading-[1.08] sm:text-5xl">
            {c.h1} <em className="italic">{c.h1Accent}</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{c.intro}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/" className="group inline-flex items-center gap-3 rounded-full bg-leaf py-3 pl-6 pr-3 text-sm font-medium text-background shadow-lift transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Upload your PDF free
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/20"><ArrowRight className="h-4 w-4" aria-hidden /></span>
            </Link>
            <Link to="/p/$slug" params={{ slug: "sample" }} className="text-sm underline underline-offset-4">View an example portfolio</Link>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell grid max-w-5xl gap-5 py-14 sm:grid-cols-3">
            {c.points.map((p) => (
              <div key={p.title} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-base font-medium">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rule-t">
          <div className="shell max-w-4xl py-14">
            <h2 className="text-sm font-medium">How it works</h2>
            <ol className="mt-5 space-y-3 text-sm">
              {c.steps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-xs font-medium text-leaf">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <ul className="mt-8 space-y-1.5 text-sm">
              {["Free plan: one PDF portfolio up to 10 MB", "Permanent sharing link", "Profile, email, LinkedIn and contact links", "Basic visit statistics"].map((i) => (
                <li key={i} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />{i}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Need more? See <Link to="/pricing" className="underline underline-offset-4">pricing</Link> for the Personal plan.</p>
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
                <Link key={o.to} to={o.to} className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-accent">{o.label}</Link>
              ))}
            </nav>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
