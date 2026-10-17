import { PricingPlans, type Billing } from "@/components/pf/PricingPlans";
import { softwareSchema } from "@/lib/portfolia/software-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Minus } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { PRICE } from "@/lib/portfolia/store";
import { PLAN_COMPARISON, PLAN_FAQ, type ComparisonValue } from "@/lib/portfolia/plans";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing — Portfolia PDF Portfolio Hosting" },
      {
        name: "description",
        content:
          `Free PDF portfolio hosting with a 3D flipbook, QR code and website embedding. Personal is ${PRICE.month}/month or ${PRICE.year}/year for your own address, password protection, no branding and more portfolios.`,
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
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(softwareSchema) },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PLAN_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }),
      },
    ],
    links: [{ rel: "canonical", href: "https://portfolia.site/pricing" }],
  }),
  component: PricingPage,
});

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) return <Check className="mx-auto size-4 text-leaf" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Not included" />;
  return <span>{value}</span>;
}

function PricingPage() {
  const [upgrade, setUpgrade] = useState(false);
  const [billing, setBilling] = useState<Billing>("year");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Button asChild size="sm" className="bg-black text-white hover:bg-black/80">
            <Link to="/" hash="upload">Create a portfolio</Link>
          </Button>
        }
      />
      <main className="flex-1">
        <section className="shell py-14 text-center sm:py-20">
          <h1 className="display-title text-4xl sm:text-6xl">Simple pricing. Free to start.</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Put one portfolio online free, forever. Upgrade to Personal when you want your own address,
            password protection and no Portfolia branding.
          </p>
          <PricingPlans
            className="mt-10 text-left"
            onChoosePersonal={(b) => { setBilling(b); setUpgrade(true); }}
            freeAction={
              <Button asChild variant="line" size="lg" className="w-full">
                <Link to="/" hash="upload">Start for free <ArrowRight className="size-4" aria-hidden /></Link>
              </Button>
            }
          />
          <p className="mx-auto mt-5 max-w-5xl text-xs text-muted-foreground">
            Prices include any applicable taxes, shown before checkout. Secure payment by Paddle.
          </p>
        </section>

        <section aria-labelledby="compare-title" className="rule-t bg-canvas">
          <div className="shell max-w-4xl py-14">
            <h2 id="compare-title" className="display-title text-3xl">Compare plans</h2>
            <div className="mt-6 overflow-x-auto border border-border bg-background" tabIndex={0} aria-label="Plan comparison table; scroll horizontally on small screens">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Free and Personal plan features</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="p-4 text-left font-medium">Feature</th>
                    <th scope="col" className="w-32 p-4 text-center font-medium">Free</th>
                    <th scope="col" className="w-32 bg-leaf-soft/60 p-4 text-center font-medium text-leaf">Personal</th>
                  </tr>
                </thead>
                {PLAN_COMPARISON.map((group) => (
                  <tbody key={group.group}>
                    <tr><th scope="rowgroup" colSpan={3} className="bg-muted px-4 py-2 text-left text-xxs font-semibold uppercase tracking-wide text-muted-foreground">{group.group}</th></tr>
                    {group.rows.map((row) => (
                      <tr key={row.label} className="border-t border-border">
                        <th scope="row" className="p-4 text-left font-normal">{row.label}</th>
                        <td className="p-4 text-center text-muted-foreground"><Cell value={row.free} /></td>
                        <td className="bg-leaf-soft/30 p-4 text-center"><Cell value={row.personal} /></td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" className="rule-t">
          <div className="shell max-w-3xl py-14">
            <h2 id="faq-title" className="display-title text-3xl">Questions</h2>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {PLAN_FAQ.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Still unsure? Email <a href="mailto:hello@portfolia.site" className="underline underline-offset-4">hello@portfolia.site</a>. See our{" "}
              <Link to="/refund" className="underline underline-offset-4">refund policy</Link> and{" "}
              <Link to="/terms" className="underline underline-offset-4">terms</Link>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <UpgradeModal open={upgrade} initialBilling={billing} onClose={() => setUpgrade(false)} />
    </div>
  );
}
