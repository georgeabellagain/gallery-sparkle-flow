import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("lookbook-maker");

export const Route = createFileRoute("/lookbook-maker")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});