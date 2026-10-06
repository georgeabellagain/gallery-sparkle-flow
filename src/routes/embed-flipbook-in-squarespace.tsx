import { createFileRoute } from "@tanstack/react-router";
import { EmbedGuide, embedGuideHead } from "@/components/pf/EmbedGuide";
export const Route = createFileRoute("/embed-flipbook-in-squarespace")({ staticData: { sitemap: true }, head: () => embedGuideHead("squarespace"), component: () => <EmbedGuide platform="squarespace" /> });
