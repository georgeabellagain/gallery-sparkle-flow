import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { PLAN_COMPARISON, type ComparisonValue } from "@/lib/portfolia/plans";
import { BUSINESS_PRICE, PRICE } from "@/lib/portfolia/store";

/* The pricing page's comparison (plan 2, S7): who each plan is for, then the table in collapsible groups. On phones one
   plan column shows at a time; on desktop the plan names stay in view while the table scrolls. */

const PLANS = [
  { id: "free", name: "Free" },
  { id: "personal", name: "Personal" },
  { id: "business", name: "Business" },
] as const;
type PlanId = (typeof PLANS)[number]["id"];
const OPEN_GROUPS = ["Hosting", "Digital Product Studio"];

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) return <Check className="mx-auto size-4 text-leaf" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Not included" />;
  return <span>{value}</span>;
}

const valueFor = (row: (typeof PLAN_COMPARISON)[number]["rows"][number], plan: PlanId) => plan === "business" ? row.business ?? row.personal : row[plan];

export function WhichPlan() {
  const cases = [
    { plan: "Free", who: "Sharing one portfolio", text: "One link, QR code and embed, with the 3D flipbook. Free for good." },
    { plan: "Personal", who: "Your own address and privacy", text: `portfolia.site/yourname, passwords, expiry and no Portfolia credit. ${PRICE.month} a month.` },
    { plan: "Business", who: "Selling, or running a studio", text: `More portfolios and products, larger PDFs and your team’s lead alerts. ${BUSINESS_PRICE.month} a month.` },
  ];
  return <div className="grid gap-4 sm:grid-cols-3">
    {cases.map(c => <div key={c.plan} className="rounded-2xl border border-border bg-card p-6"><p className="label-xs">{c.plan}</p><h3 className="mt-2 text-base font-medium">{c.who}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p></div>)}
  </div>;
}

export function PlanCompare() {
  const [plan, setPlan] = useState<PlanId>("personal");
  return <div className="mt-8">
    {/* Phones: one plan at a time. */}
    <div role="radiogroup" aria-label="Plan to show" className="mb-4 inline-flex rounded-full border border-border p-1 sm:hidden">
      {PLANS.map(p => <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} onClick={() => setPlan(p.id)} className={`rounded-full px-4 py-1.5 text-sm ${plan === p.id ? "bg-foreground text-background" : ""}`}>{p.name}</button>)}
    </div>
    <div className="space-y-3">
      {PLAN_COMPARISON.map(group => <details key={group.group} open={OPEN_GROUPS.includes(group.group)} className="group rounded-2xl border border-border bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
          {group.group}<span aria-hidden className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
        </summary>
        <table className="w-full text-sm">
          <caption className="sr-only">{group.group}: what each plan includes</caption>
          <thead className="hidden sm:table-header-group">
            <tr className="sticky top-0 z-10 border-t border-border bg-background/95 backdrop-blur">
              <th scope="col" className="p-4 text-left font-medium">Feature</th>
              {PLANS.map(p => <th key={p.id} scope="col" className={`w-32 p-4 text-center font-medium ${p.id === "personal" ? "text-leaf" : ""}`}>{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {group.rows.map(row => <tr key={row.label} className="border-t border-border">
              <th scope="row" className="p-4 text-left font-normal">{row.label}</th>
              {PLANS.map(p => <td key={p.id} className={`p-4 text-center ${p.id === plan ? "" : "hidden sm:table-cell"} ${p.id === "personal" ? "sm:bg-leaf-soft/30" : "text-muted-foreground"}`}>
                <span className="sr-only sm:hidden">{p.name}: </span><Cell value={valueFor(row, p.id)} />
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </details>)}
    </div>
  </div>;
}
