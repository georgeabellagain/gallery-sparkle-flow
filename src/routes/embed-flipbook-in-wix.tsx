import { createFileRoute } from "@tanstack/react-router";
import { EmbedGuide, embedGuideHead } from "@/components/pf/EmbedGuide";
export const Route = createFileRoute("/embed-flipbook-in-wix")({ staticData: { sitemap: true }, head: () => embedGuideHead("wix"), component: () => <EmbedGuide platform="wix" /> });
