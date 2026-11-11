/**
 * Where sign-in sends someone afterwards. `next` comes from the address bar, so only the values listed here are
 * honoured; anything else goes to the dashboard. Never accept a free-form return URL.
 */
export const SIGNIN_NEXT = ["home", "account", "create", "products-upload"] as const;
export type SigninNext = (typeof SIGNIN_NEXT)[number];
export type SigninDestination = "/" | "/account" | "/create" | "/dashboard" | "/products?pending=1";

export function signinDestination(next: string | undefined, hasDraft: boolean): SigninDestination {
  if (next === "home") return "/";
  if (next === "account") return "/account";
  if (next === "create" && hasDraft) return "/create";
  // A product PDF dropped on a landing page before signing in: the product list creates the product from it.
  if (next === "products-upload") return "/products?pending=1";
  return "/dashboard";
}
