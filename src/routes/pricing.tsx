import { softwareSchema } from "@/lib/portfolia/software-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE } from "@/lib/portfolia/store";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing — Portfolia PDF Portfolio Hosting" },
      {
        name: "description",
        content:
          "Portfolia pricing: host one PDF portfolio free with a sharing link and QR code, or choose Personal for more portfolios, a CV and a personalised address.",
      },
      { property: "og:title", content: "Pricing — Portfolia PDF Portfolio Hosting" },
      {
        property: "og:description",
        content:
          "Compare the Free and Personal plans for hosting and sharing your PDF portfolio.",
      },
      { property: "og:url", content: "https://portfolia.site/pricing" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(softwareSchema) }],
    links: [{ rel: "canonical", href: "https://portfolia.site/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [upgrade, setUpgrade] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Link to="/" hash="upload" className="hover:underline underline-offset-4">
            Create a portfolio
          </Link>
        }
      />
      <main className="flex-1">
        <section className="shell py-14 sm:py-16">
          <h1 className="display-title text-3xl sm:text-4xl">Pricing</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Start free with one PDF portfolio and a permanent sharing address. Move to
            Personal when you need more space, more portfolios and a more personal
            address.
          </p>

          <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2">
            <Plan
              name="Free"
              price="£0"
              description="A complete, permanent starting point for one portfolio."
              items={[
                "One PDF portfolio up to 10 MB",
                "Permanent Portfolia sharing address",
                "Downloadable personal QR code",
                "Profile and contact links",
                "Simple and 3D Studio flipbooks",
                "Scroll and page-by-page viewing",
                "Embed your portfolio on another website",
                "Basic visit statistics",
                "Replace your PDF without changing its link",
                "Small Portfolia credit",
              ]}
              action={
                <Button asChild variant="line" size="sm" className="mt-5">
                  <Link to="/" hash="upload">
                    Start for free <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              }
            />
            <Plan
              name="Personal"
              price={`${PRICE.month}/month or ${PRICE.year}/year`}
              description="For professionals managing a broader body of work and a more personal presence."
              featured
              items={[
                "Everything included in Free",
                "Up to 10 portfolios, each up to 50 MB",
                "CV displayed with your profile",
                "Personalised address such as portfolia.site/marksmith",
                "Password protection and link expiry", "Portfolia credit removed",
              ]}
              action={
                <Button size="lg" className="mt-5" onClick={() => setUpgrade(true)}>
                  Choose Personal
                </Button>
              }
            />
          </div>

          <p className="mx-auto mt-4 max-w-5xl text-xs text-muted-foreground">
            Prices are shown before checkout and include any applicable taxes at
            payment. You may cancel at any time; cancellation does not immediately
            delete your work.
          </p>

          <div className="mx-auto mt-12 max-w-2xl">
            <h2 className="text-sm font-medium">Questions</h2>
            <dl className="mt-4 space-y-5 text-sm">
              <div>
                <dt className="font-medium">Can I change plan later?</dt>
                <dd className="mt-1 text-muted-foreground">
                  Yes. You can move between monthly and yearly billing, or back to Free,
                  at any time from your dashboard.
                </dd>
              </div>
              <div>
                <dt className="font-medium">What happens if I cancel?</dt>
                <dd className="mt-1 text-muted-foreground">
                  Access continues to the end of the paid period, your portfolios keep
                  their existing links, and nothing is deleted when you cancel.
                </dd>
              </div>
              <div>
                <dt className="font-medium">How do people find my portfolio?</dt>
                <dd className="mt-1 text-muted-foreground">
                  Every portfolio gets a permanent Portfolia link and a QR code. On
                  Personal you can also choose a personalised address.
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">
              See our <Link to="/refund" className="underline underline-offset-4">refund policy</Link> and{" "}
              <Link to="/terms" className="underline underline-offset-4">terms</Link>.
            </p>
          </div>

          <DemoNote className="mt-10 max-w-2xl">{LOCAL_NOTE}</DemoNote>
        </section>
      </main>
      <SiteFooter />
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Plan({
  name,
  price,
  description,
  items,
  action,
  featured,
}: {
  name: string;
  price: string;
  description: string;
  items: string[];
  action?: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative rounded-3xl border bg-card p-7 ${featured ? "border-leaf shadow-lift sm:-translate-y-2" : "border-border shadow-soft"}`}
    >
      {featured && (
        <span className="absolute right-5 top-5 rounded-full bg-leaf-soft px-3 py-1 text-xxs font-medium uppercase text-leaf">
          Recommended
        </span>
      )}
      <h3 className="text-base font-medium">{name}</h3>
      <p className="mt-2 text-2xl font-medium tracking-tight">{price}</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />
            {i}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}
