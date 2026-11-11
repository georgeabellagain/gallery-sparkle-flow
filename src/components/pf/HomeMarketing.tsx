import {Link} from "@tanstack/react-router";
import {BookOpen, Lock} from "lucide-react";
import {PricingPlans, type Billing} from "./PricingPlans";
import {SiteFooter} from "./Chrome";
import {Button} from "@/components/ui/button";
import {PLAN_FAQ} from "@/lib/portfolia/plans";
import {FeatureGrid} from "./HomeHighlights";
import {ExamplesTeaser, FeatureRows, HowItWorks, ProductBand} from "./HomeSections";
import {CareRow, ProofStrip} from "./ProofStrip";

/**
 * The home page below the hero, in the order of plan 2 (S3): proof, three steps, four feature rows, the other features,
 * examples, products, plan cards, how we look after your work, questions and the closing call to action.
 * "Why send a link instead of a PDF?" now lives on /pdf-to-link and the price comparison on the competitor pages
 * (owner decision 2, default).
 */
export function HomeMarketing({onUpgrade}:{onUpgrade:(billing:Billing,plan?:"personal"|"business")=>void}) {
 return <div className="bg-background">
   <ProofStrip />
   <HowItWorks />
   <FeatureRows />
   <FeatureGrid omit={["Hotspots and buttons", "Reader insights", "Share anywhere"]} title="And everything else" />
   <ExamplesTeaser />
   <ProductBand />

   <section id="pricing" aria-labelledby="home-pricing-title" className="rule-t py-16 sm:py-24">
    <div className="shell">
     <h2 id="home-pricing-title" className="display-title text-center text-3xl sm:text-4xl">Start free. Make it yours.</h2>
     <p className="mx-auto mt-3 max-w-xl text-center text-[15px] text-muted-foreground">Free gets your portfolio online properly. Personal gives it your name, your privacy settings and no Portfolia branding.</p>
     <PricingPlans className="mt-8" onChoosePersonal={(b) => onUpgrade(b, "personal")} onChooseBusiness={(b) => onUpgrade(b, "business")} freeAction={<Button asChild variant="line" size="lg" className="w-full"><a href="#upload">Start for free</a></Button>} />
     <p className="mt-6 text-center text-sm"><Link to="/pricing" className="underline underline-offset-4">Compare every feature</Link></p>
    </div>
   </section>

   <CareRow />

   <section aria-labelledby="faq-title" className="rule-t">
    <div className="shell grid max-w-6xl gap-8 py-16 sm:py-24 lg:grid-cols-[1fr_2fr]">
     <h2 id="faq-title" className="display-title text-3xl sm:text-4xl">Questions</h2>
     <div className="divide-y divide-border border-y border-border">
      {PLAN_FAQ.slice(0, 6).map(f => <details key={f.q} className="group py-4">
       <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">{f.q}<span aria-hidden className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span></summary>
       <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
      </details>)}
     </div>
    </div>
   </section>

   <section className="rule-t bg-foreground text-background">
    <div className="shell flex flex-col items-start gap-6 py-16 sm:flex-row sm:items-center sm:justify-between">
     <div>
      <h2 className="display-title text-3xl sm:text-4xl">Give your work the presentation it deserves.</h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-background/70"><Lock className="size-3.5" aria-hidden /> Free forever for one portfolio. No card needed.</p>
     </div>
     <div className="flex flex-wrap gap-3">
      <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90"><a href="#upload">Upload your PDF</a></Button>
      <Button asChild size="lg" variant="ghost" className="text-background hover:bg-background/10 hover:text-background"><a href="/examples"><BookOpen aria-hidden /> See examples</a></Button>
     </div>
    </div>
   </section>
   <SiteFooter className="mt-0" />
 </div>;
}
