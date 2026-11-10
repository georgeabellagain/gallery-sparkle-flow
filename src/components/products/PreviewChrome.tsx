import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shop-preview overlay shared by the product page and the homepage example:
 * a "Preview" label, a buy button, and an end-of-preview card on the last spread. */
export function PreviewChrome({
  buyUrl,
  pages,
  page,
  className,
}: {
  buyUrl?: string;
  pages: number;
  page: number;
  className?: string;
}) {
  void page;
  return (
    <>
      <span className="pointer-events-none absolute right-4 top-16 z-30 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] shadow-soft backdrop-blur-sm">
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        Preview{pages > 0 && <span className="font-normal normal-case tracking-normal text-muted-foreground">· {pages} pages</span>}
      </span>
      {buyUrl && (
        <div className={cn("pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4", className)}>
          <div data-preview-buy className="pointer-events-auto flex items-center gap-3 rounded-full bg-background/90 py-1.5 pl-4 pr-1.5 shadow-soft backdrop-blur-sm">
            <p className="display-title text-base">See <em>every</em> page</p>
            <Button asChild size="sm">
              <a href={buyUrl} target="_blank" rel="noopener noreferrer">Buy the full product ↗</a>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
