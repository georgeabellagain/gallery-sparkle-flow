import { BookOpen, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "portfolios", href: "/dashboard", label: "Portfolios", hint: "Work you share", Icon: BookOpen },
  { key: "products", href: "/products", label: "Products", hint: "PDFs you sell", Icon: ShoppingBag },
] as const;

/** The switch between the two workspaces. The same control sits at the top of both, so it is always clear which one you are in. */
export function WorkspaceTabs({ active }: { active: "portfolios" | "products" }) {
  return (
    <nav aria-label="Workspace" className="mb-8 inline-flex max-w-full gap-1 rounded-2xl bg-muted p-1">
      {TABS.map(({ key, href, label, hint, Icon }) => (
        <a
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-xl px-4 py-2 text-sm transition-colors",
            active === key ? "bg-background font-medium shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block leading-tight">{label}</span>
            <span className="hidden text-[11px] font-normal leading-tight text-muted-foreground sm:block">{hint}</span>
          </span>
        </a>
      ))}
    </nav>
  );
}
