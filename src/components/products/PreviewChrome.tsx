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
  // Flipbook spreads after the cover are 2-3, 4-5, ...; the last spread holds the final page.
  const atEnd = pages > 1 && page >= pages - (pages % 2 ? 1 : 0);
  return (
    <>
      <span className="pointer-events-none absolute right-4 top-16 z-30 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] shadow-soft backdrop-blur-sm">
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        Preview{pages > 0 && <span className="font-normal normal-case tracking-normal text-muted-foreground">· {pages} pages</span>}
      </span>
      {buyUrl && (
        <div className={cn("pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center px-4", className)}>
          <div
            className={cn(
              "pointer-events-auto flex flex-col items-center text-center transition-all duration-500",
              atEnd && "rounded-[1.75rem] bg-background/95 px-6 py-5 shadow-lift backdrop-blur-md",
            )}
          >
            {atEnd && (
              <>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">End of the preview</p>
                <p className="display-title mt-1.5 text-2xl">
                  See <em>every</em> page
                </p>
              </>
            )}
            <Button asChild className={cn("shadow-lift", atEnd && "mt-3")}>
              <a href={buyUrl} target="_blank" rel="noopener noreferrer">
                Buy the full product ↗
              </a>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
