import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("how-to-send-a-portfolio");

export const Route = createFileRoute("/how-to-send-a-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});