import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import samplePage from "@/assets/sample-page.jpg";
import { SiteHeader, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { DropZone } from "@/components/pf/DropZone";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE, startPortfolio, useDoc } from "@/lib/portfolia/store";
import { getRequestOrigin } from "@/lib/origin.functions";

export const Route = createFileRoute("/")({
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
                onAccepted={(pdf) => {
                  if (!startPortfolio(pdf)) return setErr("Your browser refused to save. Free some storage and try again.");
                  void navigate({ to: "/create" });
                }}
              />
            )}
            {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
            <p className="mt-3 text-xs text-muted-foreground">No account needed to upload and preview.</p>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-14">
            <h2 className="text-sm font-medium">What visitors see</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Your details on top, your PDF below — exactly as you designed it, on a calm dark background.</p>
            <Link to="/p/$slug" params={{ slug: "sample" }} aria-label="Open the example portfolio" className="group mt-6 block max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border" /><span className="h-2.5 w-2.5 rounded-full bg-border" /><span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="ml-3 rounded-full bg-muted px-3 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">portfolia.site/marta</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-soft text-xs font-medium text-leaf">MO</span>
                <div className="text-left">
                  <p className="text-sm font-medium">Marta Oyelaran</p>
                  <p className="text-xs text-muted-foreground">Architect ARB</p>
                </div>
                <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Email · Website · CV</span>
              </div>
              <div className="bg-foreground px-6 py-8 sm:px-14 sm:py-12">
                <img src={samplePage} alt="First page of the example PDF portfolio, shown in the Portfolia viewer" width={818} height={578} loading="lazy" className="mx-auto w-full rounded-sm transition-transform duration-500 group-hover:scale-[1.01]" />
                <p className="mt-4 text-center text-[0.6875rem] text-background/60">1 / 6 · scroll or page by page</p>
              </div>
            </Link>
          </div>
        </section>

        <section className="rule-t">
          <div className="shell py-14">
            <h2 className="text-sm font-medium">Plans</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
              <Plan name="Free" price="£0" items={["One PDF portfolio", "Address like portfolia.site/p/8fh2k", "Profile and contact links", "Clean PDF viewer", "Basic visit statistics", "Replace your PDF, keep your link", "Small “Hosted on Portfolia” credit"]} />
              <Plan
                name="Personal"
                price={`${PRICE.month}/month or ${PRICE.year}/year`}
                items={["Everything in Free", "Up to 10 portfolios", "Upload a CV with your details", "Personalised address like portfolia.site/marksmith", "Connect your own domain free, or buy one here", "Portfolia credit removed"]}
                action={<Button variant="line" size="sm" className="mt-5" onClick={() => setUpgrade(true)}>Choose Personal</Button>}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Provisional pricing. Both plans accept PDFs up to 25 MB. Addresses shown are illustrative.</p>
            <DemoNote className="mt-8 max-w-2xl">{LOCAL_NOTE}</DemoNote>
          </div>
        </section>
      </main>
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Plan({ name, price, items, action }: { name: string; price: string; items: string[]; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <h3 className="text-base font-medium">{name}</h3>
      <p className="text-sm text-muted-foreground">{price}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />{i}</li>
        ))}
      </ul>
      {action}
    </div>
  );
}
