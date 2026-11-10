/**
 * What each plan includes in Digital Product Studio. One source of truth for the server functions, the editor and the
 * plan copy; the same numbers are enforced in the database (20261110130000_product_studio_plans.sql).
 * Free is a try-out: build one product and see its preview, but publishing and customer links need a paid plan.
 */
export type ProductPlan = "free" | "personal" | "business";
export const PRODUCT_ALLOWANCE: Record<ProductPlan, { products: number; mb: number; publish: boolean }> = {
  free: { products: 1, mb: 30, publish: false },
  personal: { products: 10, mb: 100, publish: true },
  business: { products: 50, mb: 250, publish: true },
};
export const productAllowance = (plan: ProductPlan) => PRODUCT_ALLOWANCE[plan] ?? PRODUCT_ALLOWANCE.free;
export const PUBLISH_NEEDS_PLAN = "Publishing a product is part of Personal and Business. Upgrade to publish and share it.";

/** The one thing a product needs next, so every screen points at the same step. */
export type ProductStep = "upload" | "preview" | "publish" | "share";
export function nextProductStep(p: { status: string; hasFile: boolean; hasPreview: boolean }): ProductStep {
  if (!p.hasFile) return "upload";
  if (!p.hasPreview) return "preview";
  return p.status === "published" ? "share" : "publish";
}

/** A first preview without any choices: the cover and the first spread. */
export function defaultPreviewPages(total: number): number[] {
  return [1, 2, 3].filter((n) => n <= total);
}
