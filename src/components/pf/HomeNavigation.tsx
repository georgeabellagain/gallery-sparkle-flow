const pages = [
  ["/architecture-portfolio", "Architecture"], ["/graphic-design-portfolio", "Graphic design"],
  ["/fashion-portfolio", "Fashion"], ["/photography-portfolio", "Photography"],
  ["/zine-flipbook", "Zines"], ["/magazine-flipbook", "Magazines"],
];
export function HomeNavigation() {
  return <nav aria-label="Explore Portfolia" className="rule-b relative z-30">
    <div className="shell flex items-center gap-5 py-2 text-xs sm:text-sm">
      <details className="group relative" onKeyDown={e => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); } }}>
        <summary className="cursor-pointer rounded py-2 text-foreground">For your work</summary>
        <div className="absolute left-0 top-full z-30 grid w-64 gap-1 rounded-xl border border-border bg-background p-2 shadow-soft">
          {pages.map(([url, label]) => <a key={url} href={url} className="rounded-lg px-3 py-2.5 hover:bg-muted focus-visible:bg-muted">{label}</a>)}
        </div>
      </details>
      <a href="/portfolio-checker" className="py-2 text-muted-foreground hover:text-foreground">PDF checker</a>
      <a href="/pricing" className="py-2 text-muted-foreground hover:text-foreground">Pricing</a>
      <a href="#upload" className="ml-auto hidden py-2 font-medium text-leaf sm:block">Try your PDF</a>
    </div>
  </nav>;
}
