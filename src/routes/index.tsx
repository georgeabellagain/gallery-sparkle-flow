import { HomeNavigation } from "@/components/pf/HomeNavigation";
import { FeatureShowcase } from "@/components/pf/FeatureShowcase";
import { softwareSchema } from "@/lib/portfolia/software-schema";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { StudioDemo } from "@/components/pf/StudioDemo";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE, startPortfolio, uploadLimitMb, useDoc } from "@/lib/portfolia/store";


export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  loader: () => ({ origin: "https://portfolia.site" }),
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
      scripts: [{ type: "application/ld+json", children: JSON.stringify(softwareSchema) }, {
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
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader
        right={
          doc.account.signedIn ? (
            <Link to="/dashboard" className="hover:underline underline-offset-4">Dashboard</Link>
          ) : (
            <Link to="/signin" className="hover:underline underline-offset-4">Sign in</Link>
          )
        }
      />
      <HomeNavigation />
      <main className="flex-1">
        {/* Try a PDF immediately, beside the existing live example. */}
        <section className="shell py-12 sm:py-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-14 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)] xl:gap-20">
            <div className="min-w-0 text-center lg:text-left">
              <div className="inline-flex rounded-full border border-border px-4 py-1.5 text-xxs font-medium uppercase text-muted-foreground">PDF flipbook hosting</div>
              <h1 className="display-title mt-6 text-4xl leading-[1.08] sm:text-5xl xl:text-6xl">
                Your PDF portfolio.<br /><em className="italic text-leaf">One simple link.</em>
              </h1>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground lg:mx-0 xl:max-w-xl xl:text-base">
                Turn the PDF you already designed into a free flipbook. Send clients and recruiters a link, keep your layout, and update your work without sending another attachment.
              </p>
              <div id="upload" className="mt-6 scroll-mt-6 text-center">
                {published ? (
                  <div className="rounded-2xl border border-border bg-card p-6 text-sm">
                    <p>Your portfolio is published.</p>
                    <Button asChild className="mt-4"><Link to="/dashboard">Open dashboard</Link></Button>
                  </div>
                ) : (
                  <DropZone small label="Preview my PDF free" limitMb={uploadLimitMb(doc)} onAccepted={(pdf) => {
                    setErr(null);
                    if (!startPortfolio(pdf)) return setErr("Your browser refused to save. Free some storage and try again.");
                    void navigate({ to: "/create" });
                  }} />
                )}
                {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
                {!published && <p className="mt-3 text-xs text-muted-foreground">No sign-up to preview. Sign in to save and publish.</p>}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-sm lg:justify-start">
                <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="font-medium text-leaf hover:underline underline-offset-4">View a live example <ArrowRight className="inline size-4" aria-hidden /></Link>
                <Link to="/pricing" className="text-muted-foreground hover:underline underline-offset-4">Compare plans</Link>
              </div>
            </div>
            <StudioDemo className="w-full min-w-0 max-w-full" />
          </div>
        </section>

        <FeatureShowcase />

        <section className="rule-t">
          <div className="shell py-12">
            <h2 className="display-title text-3xl">Ready in three steps.</h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {[
                ["Upload", "Start with the PDF you already designed."],
                ["Make it yours", "Choose your reading style, background and finishing touches."],
                ["Share", "Publish once. Send a link, QR code or website embed."],
              ].map(([title, body], i) => <li key={title} className="border-t border-border pt-4"><span className="text-xs text-leaf">0{i+1}</span><h3 className="mt-2 text-sm font-medium">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{body}</p></li>)}
            </ol>
          </div>
        </section>



        <section className="rule-t">
          <div className="shell py-14">
            <h2 className="text-sm font-medium">Plans</h2>
            <div className="mx-auto mt-7 grid grid-cols-1 max-w-5xl gap-5 sm:grid-cols-2">
               <Plan name="Free" price="£0" description="A complete, permanent starting point for one portfolio." items={["One portfolio · up to 10 MB", "Simple and Studio flipbooks", "Sharing link, QR code and embedding", "Visit statistics"]} action={<Button asChild variant="line" className="mt-5"><a href="#upload">Start free</a></Button>} />
              <Plan
                name="Personal"
                price={`${PRICE.month}/month or ${PRICE.year}/year`}
                description="For professionals managing a broader body of work and a more personal presence."
                featured
                items={["Everything in Free · 10 portfolios, 50 MB each", "Personal address and downloadable CV", "Passwords and expiring links", "No Portfolia credit"]}
                action={<Button size="lg" className="mt-5" onClick={() => setUpgrade(true)}>Choose Personal</Button>}
              />
            </div>
            <p className="mx-auto mt-4 max-w-5xl text-xs text-muted-foreground">Prices are shown before checkout. You may cancel at any time; cancellation does not immediately delete your work.</p>
            <Link to="/pricing" className="mt-6 inline-block text-sm underline underline-offset-4">Compare all plan features →</Link>
          </div>
        </section>
        <section id="about" className="rule-t scroll-mt-6">
          <div className="shell grid gap-6 py-12 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-medium">About Portfolia</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Portfolia is an independent PDF portfolio hosting service run by George Bell. It helps you share the portfolio you already designed, with a permanent link, a choice of reading modes and a downloadable QR code.</p>
            </div>
            <div>
              <h2 className="text-lg font-medium">Need a hand?</h2>
              <p className="mt-3 text-sm text-muted-foreground">For upload, account or billing questions, email <a href="mailto:hello@portfolia.site" className="underline underline-offset-4">hello@portfolia.site</a>.</p>
              <p className="mt-3 text-xs text-muted-foreground">Published portfolios are unlisted by default. Anyone with the link can view them unless you add Personal password protection or expiry; search indexing is optional.</p>
            </div>
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
    <div className={`relative rounded-3xl border bg-card p-7 ${featured ? "border-leaf" : "border-border"}`}>
      {featured && <span className="absolute right-5 top-5 rounded-full bg-leaf-soft px-3 py-1 text-xxs font-medium uppercase text-leaf">Recommended</span>}
      <h3 className="pr-28 text-base font-medium">{name}</h3>
      <p className="mt-2 text-2xl font-medium tracking-tight">{price}</p>
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
