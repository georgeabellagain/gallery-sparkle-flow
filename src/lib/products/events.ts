/**
 * Feature C, browser side: a preview view is counted once per browser session per product, and Buy clicks as they
 * happen. Fire and forget: nothing waits for it, and the homepage demo never calls it.
 */
import { productId } from "./model";

/** A route parameter is a product id or a readable address (Feature B). */
export const productRef = (param: string) => (productId.safeParse(param).success ? { id: param } : { ref: param });

export function sendProductEvent(id: string, kind: "preview_view" | "buy_click") {
  if (typeof window === "undefined") return;
  // Not awaited: the Buy button opens the shop in a new tab, so nothing is delayed. (A server function needs its own
  // request format, so navigator.sendBeacon is not used.)
  void import("./stats.functions").then(({ recordProductEvent }) => recordProductEvent({ data: { id, kind } })).catch(() => {});
}

export function recordOnce(id: string) {
  try {
    const key = `pf-product-view-${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode: still count this one */
  }
  sendProductEvent(id, "preview_view");
}
