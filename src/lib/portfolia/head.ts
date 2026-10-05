import { shareImageUrl, SHARE_WIDTH, SHARE_HEIGHT } from "./share-image";
import type { PublicPortfolio } from "./public.functions";

/** Head tags for a published portfolio page. Indexable only when the owner opted in. */
export function portfolioHead(data: PublicPortfolio, fallback: string) {
  const p = data?.portfolio;
  const name = p?.profile.name || fallback;
  const title = p ? `${name}${p.profile.title ? ` — ${p.profile.title}` : ""} | PDF Portfolio` : "Portfolio not found — Portfolia";
  const description = p ? (p.profile.intro || `${name}’s PDF portfolio, hosted on Portfolia.`).slice(0, 160) : "This Portfolia address has no published portfolio.";
  const image = p ? shareImageUrl(p) : undefined;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ...(image ? [
        { property: "og:image", content: image },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: String(SHARE_WIDTH) },
        { property: "og:image:height", content: String(SHARE_HEIGHT) },
        { property: "og:image:alt", content: `${name} — portfolio cover` },
        { name: "twitter:image", content: image },
        { name: "twitter:image:alt", content: `${name} — portfolio cover` },
      ] : []),
      { name: "robots", content: p?.searchIndexing ? "index, follow" : "noindex, nofollow" },
    ],
  };
}

