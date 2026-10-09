import { notFound } from "@tanstack/react-router";
import { getPublicPortfolio } from "./public.functions";
import { portfolioAccessStatus } from "./access.functions";

/** Missing URLs are 404s; protected portfolios retain their access screen. */
export async function loadPortfolioRoute(by: "code" | "username", value: string) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw notFound();
  const data = await getPublicPortfolio({ data: { by, value } });
  if (data) return { data, access: null };
  const access = await portfolioAccessStatus({ data: { by, value } });
  if (access.state === "missing") throw notFound();
  return { data: null, access };
}
