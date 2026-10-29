/**
 * The Paddle prices (by their external ids) and what each one buys. Business includes everything in Personal, so
 * every paid check accepts both; Business extras check `isBusinessPrice`.
 */
export const PERSONAL_PRICES = ["personal_monthly", "personal_yearly"] as const;
export const BUSINESS_PRICES = ["business_monthly", "business_yearly"] as const;
export const PLAN_PRICES = [...PERSONAL_PRICES, ...BUSINESS_PRICES] as const;
export type PlanPriceId = (typeof PLAN_PRICES)[number];

export const isPaidPrice = (id: string | null | undefined): id is PlanPriceId => (PLAN_PRICES as readonly string[]).includes(id ?? "");
export const isBusinessPrice = (id: string | null | undefined) => (BUSINESS_PRICES as readonly string[]).includes(id ?? "");
export const isYearlyPrice = (id: string | null | undefined) => Boolean(id?.endsWith("_yearly"));
/** The price for a plan and billing period. */
export const priceFor = (plan: "personal" | "business", billing: "month" | "year"): PlanPriceId => `${plan}_${billing === "year" ? "yearly" : "monthly"}`;
/** What a subscription is worth in pounds, for conversion reporting. */
export const priceValue = (id: string) => ({ personal_monthly: 3, personal_yearly: 25, business_monthly: 12, business_yearly: 99 } as Record<string, number>)[id] ?? 0;
