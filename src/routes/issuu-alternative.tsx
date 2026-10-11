import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/components/pf/SeoLanding";
import { CompetitorComparison } from "@/components/pf/CompetitorComparison";
import { COMPETITORS, comparisonContent } from "@/lib/portfolia/competitors";
const competitor = COMPETITORS.find(c => c.slug === "issuu-alternative")!;
export const Route = createFileRoute("/issuu-alternative")({
  staticData: { sitemap: true },
  head: () => seoHead(comparisonContent(competitor)),
  component: () => <CompetitorComparison competitor={competitor} />,
});
