import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import samplePage from "@/assets/sample-page.jpg";
import showSpread from "@/assets/showcase-spread.jpg";
import showMobile from "@/assets/showcase-mobile.jpg";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { BookAnimation } from "@/components/pf/BookAnimation";
import { CvIcon } from "@/components/pf/CvIcon";
import { DropZone } from "@/components/pf/DropZone";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE, startPortfolio, uploadLimitMb, useDoc } from "@/lib/portfolia/store";
import { getRequestOrigin } from "@/lib/origin.functions";

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
        <section className="shell flex flex-col items-center py-14 text-center sm:py-20">
          <div className="inline-flex rounded-full border border-border px-4 py-1.5 text-xxs font-medium uppercase text-muted-foreground">PDF flipbook hosting</div>
          <h1 className="display-title mt-7 max-w-3xl text-5xl leading-[1.02] sm:text-7xl">
            Your portfolio, <em className="italic text-leaf">brought to life.</em>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Turn your finished PDF into a smooth page-turning portfolio and share it with one simple link.
          </p>
          <div className="mt-10 sm:mt-12"><BookAnimation /></div>
          <div className="mt-12 w-full max-w-xl">
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
              <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="inline-flex items-center gap-1.5 font-medium text-leaf hover:underline underline-offset-4">View a live example <ArrowRight className="size-3.5" aria-hidden /></Link>
              <span className="size-1 rounded-full bg-border" aria-hidden />
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            </div>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-16">
            <h2 className="text-sm font-medium">What visitors see</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Your details and contact links sit directly above your original PDF on a focused dark background.</p>
            <div aria-label="Static preview of a published portfolio" className="relative mx-auto mt-7 h-[34rem] w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-soft sm:h-[42rem]">
              <div className="px-4 py-3 sm:px-6 sm:py-4">
                <div className="mx-auto max-w-[1100px]">
                  <h3 className="display-title text-xl leading-tight sm:text-2xl">Marta Oyelaran</h3>
                  <p className="text-sm text-muted-foreground">Architect ARB</p>
                  <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">Small public buildings, reading rooms and landscape structures. Currently working between Bristol and Lagos.</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" aria-hidden /> studio@example.com</span>
                    <span>LinkedIn</span>
                    <span className="inline-flex items-center gap-1.5"><CvIcon className="size-3.5" /> CV</span>
                  </div>
                </div>
              </div>
              <div className="bg-foreground px-3 py-5 sm:px-6 sm:py-7">
                <img src={samplePage} alt="Start of the first page in the example PDF portfolio" width={1648} height={1168} loading="lazy" className="mx-auto w-full rounded-sm" />
              </div>
              <div className="preview-fade pointer-events-none absolute inset-x-0 bottom-0 h-40" aria-hidden />
            </div>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-16">
            <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium">Flipbook reading</h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">Your PDF as a clean page-turning book, with full spreads on larger screens and single pages on phones.</p>
              </div>
              <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf underline-offset-4 hover:underline">Try the flipbook <ArrowRight className="size-4" aria-hidden /></Link>
            </div>
            <div className="mx-auto mt-7 grid max-w-5xl gap-5 sm:grid-cols-[1fr_0.42fr]">
              {([[showSpread, "Clean two-page spread", 1400, 555], [showMobile, "Single page on a phone", 647, 960]] as const).map(([src, label, w, h]) => (
                <Link key={label} to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="group block focus-visible:outline-none">
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                    <img src={src} alt={`${label} — screenshot of the Portfolia flipbook viewer`} width={w} height={h} loading="lazy" decoding="async" sizes="(min-width: 640px) 40vw, 100vw" className="h-56 w-full object-cover object-top" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{label}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-14">
            <h2 className="text-sm font-medium">Plans</h2>
            <div className="mx-auto mt-7 grid max-w-5xl gap-5 sm:grid-cols-2">
               <Plan name="Free" price="£0" description="A complete, permanent starting point for one portfolio." items={["One PDF portfolio up to 10 MB", "Permanent Portfolia sharing address", "Downloadable personal QR code", "Profile and contact links", "Continuous and page-by-page viewing", "Basic visit statistics", "Replace your PDF without changing its link", "Small Portfolia credit"]} />
              <Plan
                name="Personal"
                price={`${PRICE.month}/month or ${PRICE.year}/year`}
                description="For professionals managing a broader body of work and a more personal presence."
                featured
                items={["Everything included in Free", "Up to 10 portfolios, each up to 50 MB", "CV displayed with your profile", "Personalised address such as portfolia.site/marksmith", "Portfolia credit removed"]}
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
