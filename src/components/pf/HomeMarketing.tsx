import {lazy,Suspense} from "react";
import {Link} from "@tanstack/react-router";
import {PlanCard} from "./PlanCard";
import {Button} from "@/components/ui/button";
import {PRICE} from "@/lib/portfolia/store";
const FeatureShowcase=lazy(()=>import("./FeatureShowcase").then(m=>({default:m.FeatureShowcase})));

export function HomeMarketing({onUpgrade}:{onUpgrade:()=>void}) {
 return <div className="bg-background">
   <Suspense fallback={<div className="min-h-[32rem]" aria-label="Loading portfolio features" />}><FeatureShowcase /></Suspense>
   <section id="pricing" aria-labelledby="home-pricing-title" className="shell py-16 sm:py-24">
    <h2 id="home-pricing-title" className="display-title text-3xl sm:text-4xl">Start free. Make it yours.</h2>
    <p className="mt-3 text-sm text-muted-foreground">Create and share your portfolio for free, or choose Personal for more space and control.</p>
    <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2">
     <PlanCard name="Free" price="£0" description="A permanent home for your portfolio." items={["One PDF portfolio up to 10 MB","Simple and 3D Studio flipbooks","Notes, page tabs and website links","Permanent sharing link, QR code and embedding","Basic visit statistics"]} action={<Button asChild variant="line" size="lg" className="w-full"><a href="#upload">Start for free</a></Button>} />
     <PlanCard name="Personal" price={PRICE.month} period="/month" alternative={`${PRICE.year} billed yearly`} featured description="More portfolios and a more personal presence." items={["Everything included in Free","Up to 10 portfolios, each up to 50 MB","Personalised portfolio address","Password protection and link expiry","CV with your profile, and no Portfolia credit"]} action={<Button size="lg" className="w-full" onClick={onUpgrade}>Choose Personal</Button>} />
    </div>
    <p className="mt-6 text-center text-sm"><Link to="/pricing" className="underline underline-offset-4">Compare plans and pricing</Link></p>
   </section>
 </div>;
}
