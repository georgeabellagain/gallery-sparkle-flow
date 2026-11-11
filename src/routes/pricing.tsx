import { PricingPlans, type Billing } from "@/components/pf/PricingPlans";
import { softwareSchema } from "@/lib/portfolia/software-schema";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { MarketingHeader, SiteFooter } from "@/components/pf/Chrome";
import { UpgradeModal, type PlanChoice } from "@/components/pf/UpgradeModal";
import { Button } from "@/components/ui/button";
import { BUSINESS_PRICE, PRICE } from "@/lib/portfolia/store";
import { PLAN_FAQ } from "@/lib/portfolia/plans";
import { PlanCompare, WhichPlan } from "@/components/pf/PlanCompare";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing — Portfolia PDF Portfolio Hosting" },
      {
        name: "description",
        content:
          `Free PDF portfolio hosting with a 3D flipbook, QR code and website embedding. Personal is ${PRICE.month}/month or ${PRICE.year}/year for your own address, password protection and no branding. Business is ${BUSINESS_PRICE.month}/month for teams.`,
      },
      { property: "og:title", content: "Pricing — Portfolia PDF Portfolio Hosting" },
      {
        property: "og:description",
        content:
          "Compare the Free, Personal and Business plans for hosting and sharing your PDF portfolio.",
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

function PricingPage() {
  const [upgrade, setUpgrade] = useState(false);
  const [billing, setBilling] = useState<Billing>("year");
  const [plan, setPlan] = useState<PlanChoice>("personal");

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <section className="shell py-14 text-center sm:py-20">
          <h1 className="display-title text-4xl sm:text-5xl">Simple pricing. Free to start.</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Put one portfolio online free, forever. Upgrade to Personal for your own address, privacy and no Portfolia
            branding, or to Business when your team publishes more.
          </p>
          <PricingPlans
            className="mt-10 text-left"
            onChoosePersonal={(b) => { setBilling(b); setPlan("personal"); setUpgrade(true); }}
            onChooseBusiness={(b) => { setBilling(b); setPlan("business"); setUpgrade(true); }}
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

        <section aria-labelledby="compare-title" className="rule-t bg-muted/30">
          <div className="shell max-w-5xl py-16 sm:py-24">
            <h2 className="display-title text-3xl sm:text-4xl">Which plan is for me?</h2>
            <div className="mt-8"><WhichPlan /></div>
            <h2 id="compare-title" className="display-title mt-16 text-3xl sm:text-4xl">Compare plans</h2>
            <PlanCompare />
          </div>
        </section>
        <section aria-labelledby="faq-title" className="rule-t">
          <div className="shell max-w-4xl py-16 sm:py-24">
            <h2 id="faq-title" className="display-title text-3xl sm:text-4xl">Questions</h2>
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
      <UpgradeModal open={upgrade} initialBilling={billing} plan={plan} onClose={() => setUpgrade(false)} />
    </div>
  );
}
