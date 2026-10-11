import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/components/pf/SeoLanding";
import { CompetitorComparison } from "@/components/pf/CompetitorComparison";
import { COMPETITORS, comparisonContent } from "@/lib/portfolia/competitors";
const competitor = COMPETITORS.find(c => c.slug === "paperturn-alternative")!;
export const Route = createFileRoute("/paperturn-alternative")({
  staticData: { sitemap: true },
  head: () => seoHead(comparisonContent(competitor)),
  component: () => <CompetitorComparison competitor={competitor} />,
});
