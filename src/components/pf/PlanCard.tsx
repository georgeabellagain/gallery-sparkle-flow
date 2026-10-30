import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Keep plan hierarchy and actions consistent on the home and pricing pages. */
export function PlanCard({ name, price, period, alternative, description, items, action, featured, badge = "Recommended", footnote }: {
  name: string; price: string; period?: string; alternative?: ReactNode;
  description: string; items: string[]; action?: ReactNode; featured?: boolean;
  badge?: string; footnote?: ReactNode;
}) {
  return (
    <div className={cn("flex h-full flex-col rounded-none border bg-card p-5 sm:p-6", featured ? "border-leaf shadow-lift ring-1 ring-leaf/30" : "border-border")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium">{name}</h3>
        {featured && <span className="rounded-full bg-leaf-soft px-3 py-1 text-xxs font-medium uppercase text-leaf">{badge}</span>}
      </div>
      <div className="mt-3 min-h-[3.75rem]">
        <p className="text-4xl font-medium tracking-tight">{price}{period && <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">{period}</span>}</p>
        {alternative && <p className="mt-1 text-xs text-muted-foreground">{alternative}</p>}
      </div>
      <p className="mt-2 text-sm leading-snug text-muted-foreground">{description}</p>
      <ul className="my-4 grid gap-x-5 gap-y-1.5 text-sm lg:grid-cols-2">
        {items.map(item => <li key={item} className="flex gap-2 leading-snug"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden /><span>{item}</span></li>)}
      </ul>
      {action && <div className="mt-auto pt-1">{action}</div>}
      {footnote && <p className="mt-2 text-center text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}
