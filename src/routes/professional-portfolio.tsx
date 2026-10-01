import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { PUBLISHING_PAGES } from "@/lib/portfolia/publishing-pages";

const c = PUBLISHING_PAGES["professional-portfolio"]!;
export const Route = createFileRoute("/professional-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
