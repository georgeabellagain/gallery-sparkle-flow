export function WorkspaceTabs({ active }: { active: "portfolios" | "products" }) {
  return (
    <nav aria-label="Workspace" className="flex gap-1 border-b border-border mb-8">
      <a
        href="/dashboard"
        aria-current={active === "portfolios" ? "page" : undefined}
        className={`px-5 py-3 text-sm ${active === "portfolios" ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"}`}
      >
        Portfolios
      </a>
      <a
        href="/products"
        aria-current={active === "products" ? "page" : undefined}
        className={`px-5 py-3 text-sm ${active === "products" ? "border-b-2 border-foreground font-medium" : "text-muted-foreground"}`}
      >
        Products
      </a>
    </nav>
  );
}
