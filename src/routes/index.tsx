import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import samplePage from "@/assets/sample-page.jpg";
import samplePageTwo from "@/assets/sample-page-two.jpg";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { BookAnimation } from "@/components/pf/BookAnimation";
import { DropZone } from "@/components/pf/DropZone";
import { StudioDemo } from "@/components/pf/StudioDemo";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE, startPortfolio, uploadLimitMb, useDoc } from "@/lib/portfolia/store";
import { getRequestOrigin } from "@/lib/origin.functions";

const MIDNIGHT = "#191d3a";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  loader: async () => ({ origin: await getRequestOrigin() }),
  head: ({ loaderData }) => {
    const o = loaderData?.origin ?? "";
    const img = o ? [{ property: "og:image", content: `${o}/og-image.jpg` }, { name: "twitter:image", content: `${o}/og-image.jpg` }] : [];
    return {
      meta: [
        { title: "Free PDF Portfolio Hosting & Flipbooks | Portfolia" },
        { name: "description", content: "Host your PDF portfolio free with a professional flipbook or simple scrolling viewer. Share one link or QR code with clients, studios and recruiters." },
        { name: "keywords", content: "pdf portfolio, pdf portfolio hosting, online portfolio, portfolio website, architecture portfolio website, design portfolio, share portfolio link, portfolio for designers" },
        { property: "og:title", content: "Free PDF Portfolio Hosting & Flipbooks | Portfolia" },
        { property: "og:description", content: "Turn your PDF into a professional online portfolio with flipbook viewing, one simple link and a downloadable QR code. Free to start." },
        { property: "og:url", content: "https://portfolia.site/" },
        { property: "og:site_name", content: "Portfolia" },
        ...img,
      ],
      links: [{ rel: "canonical", href: "https://portfolia.site/" }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Portfolia",
          url: "https://portfolia.site/",
          description: "PDF portfolio hosting: upload your PDF portfolio, add your details, and share your work through one simple link.",
        }),
      }],
    };
  },
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const doc = useDoc();
  const [err, setErr] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const published = doc.account.signedIn && doc.portfolio?.status === "published";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          doc.account.signedIn ? (
            <Link to="/dashboard" className="hover:underline underline-offset-4">Dashboard</Link>
          ) : (
            <Link to="/signin" className="hover:underline underline-offset-4">Sign in</Link>
          )
        }
      />
      <main className="flex-1">
        {/* The example comes first, with the pitch beside it. */}
        <section className="shell py-12 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-14">
            <div className="text-center lg:text-left">
              <div className="inline-flex rounded-full border border-border px-4 py-1.5 text-xxs font-medium uppercase text-muted-foreground">PDF flipbook hosting</div>
              <h1 className="display-title mt-6 text-5xl leading-[1.02] sm:text-6xl">
                Your portfolio, <em className="italic text-leaf">brought to life.</em>
              </h1>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground lg:mx-0">
                Turn your finished PDF into a smooth page-turning portfolio and share it with one simple link.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-5 lg:justify-start">
                <Button asChild size="lg"><a href="#upload">Try for free <ArrowRight aria-hidden /></a></Button>
                <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf hover:underline underline-offset-4">View a live example</Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Publish one portfolio at no cost.</p>
            </div>
            <StudioDemo className="w-full" />
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-16">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div>
                <h2 className="display-title text-3xl leading-tight sm:text-4xl">From a PDF to a portfolio people enjoy opening</h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Keep the layout you spent weeks on. Portfolia adds the page turn, the lighting and a link that works everywhere, from a phone to a studio screen.
                </p>
                <ol className="mt-6 space-y-4 text-sm">
                  {[
                    ["Upload your PDF", "Drop in the file you already have. Your pages stay exactly as designed."],
                    ["Choose how it is read", "Offer scroll, page by page, or a flipbook, and set the look of the book."],
                    ["Share one link", "Send a link or a QR code. Visitors need no account and nothing to install."],
                  ].map(([title, body], i) => (
                    <li key={title} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-xs font-medium text-leaf">{i + 1}</span>
                      <span><span className="block font-medium">{title}</span><span className="text-muted-foreground">{body}</span></span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex justify-center"><BookAnimation /></div>
            </div>
          </div>
        </section>

        <section id="upload" className="rule-t scroll-mt-6">
          <div className="shell flex flex-col items-center py-16 text-center">
            <h2 className="display-title text-3xl sm:text-4xl">Try it with your own PDF</h2>
            <div className="mt-8 w-full max-w-xl">
              {published ? (
                <div className="border border-border p-8 text-sm">
                  <p>Your portfolio is published.</p>
                  <Button asChild className="mt-4"><Link to="/dashboard">Open dashboard</Link></Button>
                </div>
              ) : (
                <DropZone
                  limitMb={uploadLimitMb(doc)}
                  onAccepted={(pdf) => {
                    if (!startPortfolio(pdf)) return setErr("Your browser refused to save. Free some storage and try again.");
                    void navigate({ to: "/create" });
                  }}
                />
              )}
              {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
              <p className="mt-3 text-xs text-muted-foreground">Try for free — publish one portfolio at no cost.</p>
              <div className="mt-6 flex items-center justify-center gap-5 text-xs">
                <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-16">
            <h2 className="text-sm font-medium">Other ways to read</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Visitors can switch between styles at any time, so every viewer reads your work the way they prefer.</p>
            <div className="mx-auto mt-7 grid max-w-5xl gap-5 sm:grid-cols-2">
              <Link to="/p/$slug" params={{ slug: "sample" }} search={{}} className="group block focus-visible:outline-none">
                <div className="relative h-64 overflow-hidden rounded-2xl border border-border shadow-soft transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ring" style={{ background: MIDNIGHT }}>
                  <div className="mx-auto mt-5 w-[72%] space-y-3">
                    <img src={samplePage} alt="" width={1648} height={1168} loading="lazy" decoding="async" className="w-full rounded-sm" />
                    <img src={samplePage} alt="" width={1648} height={1168} loading="lazy" decoding="async" className="w-full rounded-sm" />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20" style={{ background: `linear-gradient(to bottom, transparent, ${MIDNIGHT})` }} aria-hidden />
                </div>
                <h3 className="mt-3 text-sm font-medium">Scroll</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Every page in one smooth, continuous column. The simplest way to read, and it works well on any screen.</p>
              </Link>
              <Link to="/p/$slug" params={{ slug: "sample" }} search={{}} className="group block focus-visible:outline-none">
                <div className="relative h-64 overflow-hidden rounded-2xl border border-border shadow-soft transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ring" style={{ background: MIDNIGHT }}>
                  {/* Two pages side by side, so it reads as a spread rather than a column of pages like Scroll. */}
                  <div className="relative mx-auto mt-9 grid w-[88%] grid-cols-2 gap-px shadow-lift" aria-hidden>
                    <img src={samplePage} alt="" width={1648} height={1168} loading="lazy" decoding="async" className="w-full rounded-l-sm" />
                     <img src={samplePageTwo} alt="" width={653} height={463} loading="lazy" decoding="async" className="w-full rounded-r-sm" />
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-6 -translate-x-1/2" style={{ background: "linear-gradient(to right, transparent, rgba(0,0,0,0.22), transparent)" }} />
                  </div>
                  <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-xxs" aria-hidden>
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/80">Previous</span>
                    <span className="tabular-nums text-white/60">2–3 / 12</span>
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/80">Next</span>
                  </div>
                </div>
                <h3 className="mt-3 text-sm font-medium">Page by page</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">One page at a time with simple previous and next controls, so each page gets the whole screen.</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-14">
            <h2 className="text-sm font-medium">Plans</h2>
            <div className="mx-auto mt-7 grid max-w-5xl gap-5 sm:grid-cols-2">
               <Plan name="Free" price="£0" description="A complete, permanent starting point for one portfolio." items={["One PDF portfolio up to 10 MB", "Permanent Portfolia sharing address", "Downloadable personal QR code", "Profile and contact links", "Continuous and page-by-page viewing", "Basic visit statistics", "Replace your PDF without changing its link"]} />
              <Plan
                name="Personal"
                price={`${PRICE.month}/month or ${PRICE.year}/year`}
                description="For professionals managing a broader body of work and a more personal presence."
                featured
                 items={["Everything included in Free", "Up to 10 portfolios, each up to 50 MB", "CV displayed with your profile", "Personalised address such as portfolia.site/marksmith"]}
                action={<Button variant="line" size="sm" className="mt-5" onClick={() => setUpgrade(true)}>Choose Personal</Button>}
              />
            </div>
            <p className="mx-auto mt-4 max-w-5xl text-xs text-muted-foreground">Prices are shown before checkout. You may cancel at any time; cancellation does not immediately delete your work.</p>
            <DemoNote className="mt-8 max-w-2xl">{LOCAL_NOTE}</DemoNote>
          </div>
        </section>
      </main>
      <SiteFooter />
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Plan({ name, price, description, items, action, featured }: { name: string; price: string; description: string; items: string[]; action?: React.ReactNode; featured?: boolean }) {
  return (
    <div className={`relative rounded-3xl border bg-card p-7 ${featured ? "border-leaf shadow-lift sm:-translate-y-2" : "border-border shadow-soft"}`}>
      {featured && <span className="absolute right-5 top-5 rounded-full bg-leaf-soft px-3 py-1 text-xxs font-medium uppercase text-leaf">Recommended</span>}
      <h3 className="text-base font-medium">{name}</h3>
      <p className="mt-1 text-sm font-medium">{price}</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />{i}</li>
        ))}
      </ul>
      {action}
    </div>
  );
}
