import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { disciplineContent } from "@/lib/portfolia/seo-pages";

const c = disciplineContent("ux-design-portfolio");

export const Route = createFileRoute("/ux-design-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
