import { patchPortfolio, type Portfolio } from "@/lib/portfolia/store";
import { bookPurchaseUrl } from "@/lib/portfolia/book-marketing";
export function BookMarketingSettings({ p }: { p: Portfolio }) {
  const book = p.bookMarketing ?? { description: "", buyUrl: "", label: "Buy the book" };
  const set = (patch: Partial<typeof book>) => patchPortfolio({ bookMarketing: { ...book, ...patch } });
  return <div className="space-y-4 text-sm">
    <h2 className="font-medium">Book marketing</h2>
    <p className="text-xs text-muted-foreground">Share a sample PDF and send readers to your shop or Amazon listing. Upload only the pages you want visitors to see.</p>
    <label className="block">Book description<textarea className="mt-1 w-full rounded-lg border bg-background p-2" maxLength={600} value={book.description} onChange={e => set({ description: e.target.value })} /></label>
    <label className="block">Purchase link<input type="url" placeholder="https://…" className="mt-1 w-full rounded-lg border bg-background p-2" maxLength={2048} value={book.buyUrl} onChange={e => set({ buyUrl: e.target.value })} /></label>
    {book.buyUrl && !bookPurchaseUrl(book.buyUrl) && <p role="alert" className="text-xs text-destructive">Enter a full http or https address.</p>}
    <label className="block">Button label<input className="mt-1 w-full rounded-lg border bg-background p-2" maxLength={60} value={book.label} onChange={e => set({ label: e.target.value })} /></label>
    <p className="text-xs text-muted-foreground">Save to update your preview page. Personal also includes an HD flip-through video under Share.</p>
  </div>;
}
