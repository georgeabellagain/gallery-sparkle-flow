import { createFileRoute } from "@tanstack/react-router";
import { EmbeddedVisitor, LOCAL_MISSING, Missing } from "@/components/pf/Visitor";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";

export const Route = createFileRoute("/embed/$code")({
  staticData: { sitemap: false },
  loader: ({ params }) => getPublicPortfolio({ data: { by: "code", value: params.code } }),
  head: () => ({
    meta: [
      { title: "Embedded PDF Portfolio — Portfolia" },
      { name: "description", content: "A compact embedded PDF portfolio viewer hosted by Portfolia." },
      { property: "og:title", content: "Embedded PDF Portfolio — Portfolia" },
      { property: "og:description", content: "A compact embedded PDF portfolio viewer hosted by Portfolia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: () => <Missing title="Couldn’t load this portfolio" body="Please refresh the page to try again." />,
  component: EmbedPage,
});

function EmbedPage() {
  const data = Route.useLoaderData();
  if (!data) return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <EmbeddedVisitor data={data} />;
}