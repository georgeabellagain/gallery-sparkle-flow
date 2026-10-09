import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Keep plan hierarchy and actions consistent on the home and pricing pages. */
export function PlanCard({ name, price, period, alternative, description, items, action, featured }: {
  name: string; price: string; period?: string; alternative?: string;
  description: string; items: string[]; action?: ReactNode; featured?: boolean;
}) {
  return (
    <div className={cn("flex h-full flex-col rounded-3xl border bg-card p-6 sm:p-7", featured ? "border-leaf shadow-soft" : "border-border")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium">{name}</h3>
        {featured && <span className="rounded-full bg-leaf-soft px-3 py-1 text-xxs font-medium uppercase text-leaf">Recommended</span>}
      </div>
      <div className="mt-5 min-h-[4.5rem]">
        <p className="text-4xl font-medium tracking-tight">{price}{period && <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">{period}</span>}</p>
        {alternative && <p className="mt-1 text-xs text-muted-foreground">or {alternative}</p>}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <ul className="my-6 space-y-3 text-sm">
        {items.map(item => <li key={item} className="flex gap-2.5 leading-relaxed"><Check className="mt-1 size-3.5 shrink-0 text-leaf" aria-hidden /><span>{item}</span></li>)}
      </ul>
      {action && <div className="mt-auto pt-2">{action}</div>}
    </div>
  );
}
