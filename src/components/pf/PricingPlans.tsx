import { useState, type ReactNode } from "react";
import { PlanCard } from "./PlanCard";
import { BUSINESS_PRICE, PRICE } from "@/lib/portfolia/store";
import { BUSINESS_FEATURES, BUSINESS_YEARLY_PER_MONTH, BUSINESS_YEARLY_SAVING, FREE_FEATURES, PERSONAL_FEATURES, YEARLY_PER_MONTH, YEARLY_SAVING } from "@/lib/portfolia/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Billing = "month" | "year";

/** Monthly/yearly switch plus the three plan cards, shared by the homepage and /pricing. */
export function PricingPlans({ freeAction, onChoosePersonal, onChooseBusiness, className }: {
  freeAction: ReactNode;
  onChoosePersonal: (billing: Billing) => void;
  onChooseBusiness: (billing: Billing) => void;
  className?: string;
}) {
  const [billing, setBilling] = useState<Billing>("year");
  const yearly = billing === "year";
  return (
    <div className={className}>
      <BillingToggle value={billing} onChange={setBilling} className="mx-auto" />
      <div className="mx-auto mt-8 grid max-w-6xl gap-5 md:grid-cols-3">
        <PlanCard
          name="Free"
          price="£0"
          period="forever"
          alternative="No card needed"
          description="Everything you need to put one portfolio online and share it properly."
          items={FREE_FEATURES}
          action={freeAction}
        />
        <PlanCard
          name="Personal"
          price={yearly ? YEARLY_PER_MONTH : PRICE.month}
          period={yearly ? "/month equivalent" : "/month"}
          alternative={yearly ? `${PRICE.year} billed yearly. Save ${YEARLY_SAVING}%` : `Billed monthly. Or ${PRICE.year} billed yearly (save ${YEARLY_SAVING}%)`}
          featured
          badge="Most popular"
          description="Make it unmistakably yours, with your own address, privacy controls and no Portfolia branding."
          items={["Everything in Free, plus:", ...PERSONAL_FEATURES]}
          action={<Button size="lg" className="w-full bg-black text-white hover:bg-black/80" onClick={() => onChoosePersonal(billing)}>Get Personal</Button>}
          footnote="Cancel anytime. Your links keep working."
        />
        <PlanCard
          name="Business"
          price={yearly ? BUSINESS_YEARLY_PER_MONTH : BUSINESS_PRICE.month}
          period={yearly ? "/month equivalent" : "/month"}
          alternative={yearly ? `${BUSINESS_PRICE.year} billed yearly. Save ${BUSINESS_YEARLY_SAVING}%` : `Billed monthly. Or ${BUSINESS_PRICE.year} billed yearly (save ${BUSINESS_YEARLY_SAVING}%)`}
          description="For studios, brands and teams publishing more, with your own analytics and lead alerts for your team."
          items={["Everything in Personal, plus:", ...BUSINESS_FEATURES]}
          action={<Button size="lg" variant="line" className="w-full" onClick={() => onChooseBusiness(billing)}>Get Business</Button>}
          footnote="Move up from Personal any time; you pay only the difference."
        />
      </div>
    </div>
  );
}

export function BillingToggle({ value, onChange, className }: { value: Billing; onChange: (b: Billing) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Billing period" className={cn("flex w-fit items-center gap-1 rounded-full border border-border bg-muted p-1 text-sm", className)}>
      {(["month", "year"] as const).map(b => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={value === b}
          onClick={() => onChange(b)}
          className={cn("rounded-full px-4 py-1.5 transition-colors", value === b ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground")}
        >
          {b === "month" ? "Monthly" : <>Yearly <span className="ml-1 rounded-full bg-leaf-soft px-2 py-0.5 text-xxs font-medium text-leaf">−{YEARLY_SAVING}%</span></>}
        </button>
      ))}
    </div>
  );
}
