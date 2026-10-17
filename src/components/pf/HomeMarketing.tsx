import {lazy,Suspense} from "react";
import {Link} from "@tanstack/react-router";
import {ArrowRight, BookOpen, Camera, Link2, Lock, RefreshCw, Sparkles, Upload} from "lucide-react";
import {PricingPlans, type Billing} from "./PricingPlans";
import {SiteFooter} from "./Chrome";
import {Button} from "@/components/ui/button";
import type {PdfFile} from "@/lib/portfolia/store";
import {PRICE} from "@/lib/portfolia/store";
import {PLAN_FAQ} from "@/lib/portfolia/plans";
const FeatureShowcase=lazy(()=>import("./FeatureShowcase").then(m=>({default:m.FeatureShowcase})));

const REASONS = [
 {icon: Sparkles, title: "It looks like the real thing", text: "A 3D flipbook lit like a studio photograph, with soft shadows and real paper. Your work feels printed, not pasted."},
 {icon: Upload, title: "Try it before you sign up", text: "Drop in your PDF and see it in every reader straight away. No account and no card until you want to publish."},
 {icon: Link2, title: "One link, everywhere", text: "Share a permanent link or a QR code, or embed it on your own website. Embedding is free on every plan."},
 {icon: RefreshCw, title: "Update without re-sending", text: "Replace your PDF whenever your work changes. The link you already sent shows the new version."},
 {icon: Camera, title: "Book photos without a shoot", text: "The Photo shoot is a 3D book visualiser: leaning, spine and flat lay mockups of your own pages, ready to download with Personal."},
];

const STEPS = [
 ["Drop your PDF", "Use the portfolio you already designed in InDesign, Figma, Canva or anything else."],
 ["Choose how it reads", "Studio flipbook, Simple, Scroll or Page by page. Add website links, page tabs and a backdrop."],
 ["Share one link", "Send it to clients, studios and recruiters, print the QR code, or embed it on your site."],
] as const;

const SWITCH = [
 {name: "Issuu", slug: "issuu-alternative", text: "Embedding on your own site needs a paid Issuu plan. On Portfolia it’s free."},
 {name: "Flipsnack", slug: "flipsnack-alternative", text: `Flipsnack Lite is listed at $14/month. Portfolia Personal is ${PRICE.month}/month.`},
 {name: "Heyzine", slug: "heyzine-alternative", text: "Heyzine is built for interactive publications. Portfolia is built to present your own creative work beautifully."},
];

export function HomeMarketing({onUpgrade,onAccepted,limitMb}:{onUpgrade:(billing:Billing)=>void;onAccepted:(pdf:PdfFile)=>void;limitMb:number}) {
 return <div className="bg-background">
   <section aria-labelledby="why-title" className="rule-t">
    <div className="shell py-14 sm:py-20">
     <p className="label-xs">Why Portfolia</p>
     <h2 id="why-title" className="display-title mt-2 max-w-2xl text-3xl sm:text-5xl">Your portfolio deserves better than a PDF attachment.</h2>
     <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
      {REASONS.map(({icon: Icon, title, text}) => <div key={title}>
       <span className="flex size-10 items-center justify-center rounded-xl bg-leaf-soft text-leaf"><Icon className="size-5" aria-hidden /></span>
       <h3 className="mt-4 text-base font-medium">{title}</h3>
       <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>)}
     </div>
    </div>
   </section>

   <section aria-labelledby="steps-title" className="rule-t bg-canvas">
    <div className="shell py-14 sm:py-16">
     <h2 id="steps-title" className="display-title text-3xl sm:text-4xl">Online in about a minute.</h2>
     <ol className="mt-8 grid gap-6 sm:grid-cols-3">
      {STEPS.map(([title, text], i) => <li key={title} className="border-t border-border-strong pt-5">
       <span className="display-title text-4xl text-leaf">{i + 1}</span>
       <h3 className="mt-2 text-base font-medium">{title}</h3>
       <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </li>)}
     </ol>
     <Button asChild size="lg" className="mt-10 bg-black text-white hover:bg-black/80"><a href="#upload">Try it with your PDF <ArrowRight aria-hidden /></a></Button>
    </div>
   </section>

   <Suspense fallback={<div className="min-h-[32rem]" aria-label="Loading portfolio features" />}><FeatureShowcase onAccepted={onAccepted} limitMb={limitMb} /></Suspense>

   <section aria-labelledby="switch-title" className="rule-t">
    <div className="shell py-14 sm:py-16">
     <p className="label-xs">Switching?</p>
     <h2 id="switch-title" className="display-title mt-2 text-3xl sm:text-4xl">Made for portfolios, not catalogues.</h2>
     <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">General flipbook tools are built for magazines and marketing teams. Portfolia does one job: presenting a finished creative portfolio as well as it can be presented.</p>
     <div className="mt-8 grid gap-4 sm:grid-cols-3">
      {SWITCH.map(s => <a key={s.slug} href={`/${s.slug}`} className="group flex flex-col border border-border p-5 transition-colors hover:border-border-strong">
       <span className="text-sm font-medium">Portfolia vs {s.name}</span>
       <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.text}</span>
       <span className="mt-4 inline-flex items-center gap-1 text-xs text-leaf">Compare <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
      </a>)}
     </div>
     <p className="mt-5 text-xs text-muted-foreground"><a href="/flipbook-alternatives" className="underline underline-offset-4">See every comparison</a>, with sources.</p>
    </div>
   </section>

   <section id="pricing" aria-labelledby="home-pricing-title" className="rule-t bg-canvas pt-12 pb-16 sm:pt-16 sm:pb-24">
    <div className="shell">
     <h2 id="home-pricing-title" className="display-title text-center text-3xl sm:text-5xl">Start free. Make it yours.</h2>
     <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">Free gets your portfolio online properly. Personal gives it your name, your privacy settings and no Portfolia branding.</p>
     <PricingPlans className="mt-8" onChoosePersonal={onUpgrade} freeAction={<Button asChild variant="line" size="lg" className="w-full"><a href="#upload">Start for free</a></Button>} />
     <p className="mt-6 text-center text-sm"><Link to="/pricing" className="underline underline-offset-4">Compare every feature</Link></p>
    </div>
   </section>

   <section aria-labelledby="faq-title" className="rule-t">
    <div className="shell grid gap-8 py-14 sm:py-16 lg:grid-cols-[1fr_2fr]">
     <h2 id="faq-title" className="display-title text-3xl sm:text-4xl">Questions</h2>
     <div className="divide-y divide-border border-y border-border">
      {PLAN_FAQ.map(f => <details key={f.q} className="group py-4">
       <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">{f.q}<span aria-hidden className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span></summary>
       <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
      </details>)}
     </div>
    </div>
   </section>

   <section className="rule-t bg-foreground text-background">
    <div className="shell flex flex-col items-start gap-6 py-14 sm:flex-row sm:items-center sm:justify-between">
     <div>
      <h2 className="display-title text-3xl sm:text-4xl">Give your work the presentation it deserves.</h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-background/70"><Lock className="size-3.5" aria-hidden /> Free forever for one portfolio. No card needed.</p>
     </div>
     <div className="flex flex-wrap gap-3">
      <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90"><a href="#upload">Upload your PDF</a></Button>
      <Button asChild size="lg" variant="ghost" className="text-background hover:bg-background/10 hover:text-background"><a href="/p/adu2v"><BookOpen aria-hidden /> See an example</a></Button>
     </div>
    </div>
   </section>
   <SiteFooter className="mt-0" />
 </div>;
}
