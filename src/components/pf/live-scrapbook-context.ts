import { createContext } from "react";
import type { Portfolio } from "@/lib/portfolia/store";
export const LiveScrapbookContext = createContext<{
  portfolio: Portfolio;
  enabled: boolean;
  onError: (message: string | null) => void;
} | null>(null);
