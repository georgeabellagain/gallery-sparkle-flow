import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("canva-flipbook");

export const Route = createFileRoute("/canva-flipbook")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});