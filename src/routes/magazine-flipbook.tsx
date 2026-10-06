import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/components/pf/SeoLanding";
import { PublicationLanding } from "@/components/pf/PublicationLanding";
import { PUBLICATION_PAGES } from "@/lib/portfolia/publication-pages";
export const Route = createFileRoute("/magazine-flipbook")({
 staticData: { sitemap: true }, head: () => seoHead(PUBLICATION_PAGES.magazine),
 component: () => <PublicationLanding kind="magazine" />,
});
