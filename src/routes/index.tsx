import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { softwareSchema } from "@/lib/portfolia/software-schema";
const HomeWorkspace = lazy(() => import("@/components/pf/HomeWorkspace").then(m => ({ default: m.HomeWorkspace })));

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  loader: () => ({ origin: "https://portfolia.site" }),
  head: ({ loaderData }) => {
    const o = loaderData?.origin ?? "";
    const img = o ? [{ property: "og:image", content: `${o}/og-image.jpg` }, { name: "twitter:image", content: `${o}/og-image.jpg` }] : [];
    return {
      meta: [
        { title: "Free PDF Portfolio Hosting & Flipbooks | Portfolia" },
        { name: "description", content: "Host your PDF portfolio free with a professional flipbook or simple scrolling viewer. Share one link or QR code with clients, studios and recruiters." },
        { name: "keywords", content: "pdf portfolio, pdf portfolio hosting, online portfolio, portfolio website, architecture portfolio website, design portfolio, share portfolio link, portfolio for designers" },
        { property: "og:title", content: "Free PDF Portfolio Hosting & Flipbooks | Portfolia" },
        { property: "og:description", content: "Turn your PDF into a professional online portfolio with flipbook viewing, one simple link and a downloadable QR code. Free to start." },
        { property: "og:url", content: "https://portfolia.site/" },
        { property: "og:site_name", content: "Portfolia" },
        ...img,
      ],
      links: [{ rel: "canonical", href: "https://portfolia.site/" }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(softwareSchema) }, {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Portfolia",
          url: "https://portfolia.site/",
          description: "PDF portfolio hosting: upload your PDF portfolio, add your details, and share your work through one simple link.",
        }),
      }],
    };
  },
  component: Landing,
});

function Landing() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#eae6df]"><p role="status" className="text-sm text-muted-foreground">Loading workspace…</p></main>}><HomeWorkspace /></Suspense>;
}
