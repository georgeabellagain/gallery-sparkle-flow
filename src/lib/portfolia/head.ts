import type { PublicPortfolio } from "./public.functions";

/** Head tags for a published portfolio page. Indexable only when the owner opted in. */
export function portfolioHead(data: PublicPortfolio, fallback: string) {
  const p = data?.portfolio;
  const name = p?.profile.name || fallback;
  const title = p ? `${name}${p.profile.title ? ` — ${p.profile.title}` : ""} | PDF Portfolio` : "Portfolio not found — Portfolia";
  const description = p ? (p.profile.intro || `${name}’s PDF portfolio, hosted on Portfolia.`).slice(0, 160) : "This Portfolia address has no published portfolio.";
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: p?.searchIndexing ? "index, follow" : "noindex, nofollow" },
    ],
  };
}
