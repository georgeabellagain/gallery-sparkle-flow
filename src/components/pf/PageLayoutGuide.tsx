/** A compact explanation of the PDF input layout; the book setting itself remains the existing selector. */
export function PageLayoutGuide({ spreads }: { spreads: "single" | "ready" }) {
  return <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
    <div className={`rounded-xl border p-2 ${spreads === "single" ? "border-foreground/40 bg-muted/50" : "border-border"}`}>
      <div aria-hidden className="mb-2 flex h-12 items-center justify-center gap-2"><span className="flex h-11 w-8 items-center justify-center border border-border bg-background shadow-sm">1</span><span className="flex h-11 w-8 items-center justify-center border border-border bg-background shadow-sm">2</span></div>
      <p className="font-medium text-foreground">One page per PDF page</p><p>Two PDF pages become the left and right pages of the book.</p>
    </div>
    <div className={`rounded-xl border p-2 ${spreads === "ready" ? "border-foreground/40 bg-muted/50" : "border-border"}`}>
      <div aria-hidden className="mb-2 flex h-12 items-center justify-center"><span className="flex h-11 w-16 border border-border bg-background shadow-sm"><span className="flex flex-1 items-center justify-center border-r border-dashed border-border">L</span><span className="flex flex-1 items-center justify-center">R</span></span></div>
      <p className="font-medium text-foreground">A spread per PDF page</p><p>Each wide PDF page is split down the middle into left and right halves.</p>
    </div>
  </div>;
}
