import { createContext } from "react";
import type { Portfolio } from "@/lib/portfolia/store";
import type { ExtraKind } from "@/lib/portfolia/scrapbook-transform";
export type ScrapbookSelection = { kind: ExtraKind; id: string } | null;
export const LiveScrapbookContext = createContext<{
  portfolio: Portfolio;
  enabled: boolean;
  onError: (message: string | null) => void;
  /** The item picked on the page, edited in the editor's side panel. */
  selected?: ScrapbookSelection;
  onSelect?: (selection: ScrapbookSelection) => void;
  /** The leaves the preview shows, so new items land on the page in view. */
  onPages?: (pages: Array<{ page: number; half?: "left" | "right" }>) => void;
} | null>(null);
