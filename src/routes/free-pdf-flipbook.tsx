import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { PUBLISHING_PAGES } from "@/lib/portfolia/publishing-pages";

const c = PUBLISHING_PAGES["free-pdf-flipbook"]!;
export const Route = createFileRoute("/free-pdf-flipbook")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
