import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("pdf-qr-code");

export const Route = createFileRoute("/pdf-qr-code")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});