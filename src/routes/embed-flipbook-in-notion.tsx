import { createFileRoute } from "@tanstack/react-router";
import { EmbedGuide, embedGuideHead } from "@/components/pf/EmbedGuide";
export const Route = createFileRoute("/embed-flipbook-in-notion")({ staticData: { sitemap: true }, head: () => embedGuideHead("notion"), component: () => <EmbedGuide platform="notion" /> });
