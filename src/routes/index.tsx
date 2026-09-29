import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Mail, Sparkles } from "lucide-react";
import samplePage from "@/assets/sample-page.jpg";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
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
        { title: "Portfolia — PDF Portfolio Hosting. One Simple Link." },
        { name: "description", content: "Host your PDF portfolio online and share it with one simple link. Ideal for architects, designers and creatives — a clean viewer, your details, visit stats. Free to start." },
        { name: "keywords", content: "pdf portfolio, pdf portfolio hosting, online portfolio, portfolio website, architecture portfolio website, design portfolio, share portfolio link, portfolio for designers" },
        { property: "og:title", content: "Portfolia — PDF Portfolio Hosting. One Simple Link." },
        { property: "og:description", content: "Turn your PDF portfolio into a personal link. A clean viewer for architects, designers and creatives." },
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
  const published = doc.portfolio?.status === "published";

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
        <section className="shell grid gap-12 pt-16 pb-16 sm:pt-24 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <h1 className="display-title text-5xl leading-[1.05] sm:text-6xl">
              Your portfolio. <em className="italic">One simple link.</em>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Upload your PDF, add your details, and share your work.
            </p>
            <Link
              to="/p/$slug"
              params={{ slug: "sample" }}
              className="group mt-8 inline-flex items-center gap-3 rounded-full bg-leaf py-3 pl-6 pr-3 text-sm font-medium text-background shadow-lift transition-all hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              View an example portfolio
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/20 transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </div>
          <div>
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
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-leaf"><Sparkles className="size-3.5" aria-hidden /> Try for free — publish one portfolio at no cost.</p>
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
          <div className="shell py-14">
            <h2 className="text-sm font-medium">Plans</h2>
            <div className="mx-auto mt-7 grid max-w-5xl gap-5 sm:grid-cols-2">
              <Plan name="Free" price="£0" description="A complete, permanent starting point for one portfolio." items={["One PDF portfolio up to 10 MB", "Permanent Portfolia sharing address", "Profile and contact links", "Continuous and page-by-page viewing", "Basic visit statistics", "Replace your PDF without changing its link", "Small Portfolia credit"]} />
              <Plan
                name="Personal"
                price={`${PRICE.month}/month or ${PRICE.year}/year`}
                description="For professionals managing a broader body of work and a more personal presence."
                featured
                items={["Everything included in Free", "Up to 10 portfolios, each up to 50 MB", "CV displayed with your profile", "Personalised address such as portfolia.site/marksmith", "Connect a domain you own at no additional charge", "Portfolia credit removed"]}
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
