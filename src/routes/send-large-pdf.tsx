import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("send-large-pdf");

export const Route = createFileRoute("/send-large-pdf")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});