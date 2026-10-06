import { AccessGate } from "@/components/pf/AccessGate";
import { createFileRoute } from "@tanstack/react-router";
import { EmbeddedVisitor, LOCAL_MISSING, Missing } from "@/components/pf/Visitor";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";

export const Route = createFileRoute("/embed/$code")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { page?: number; mode?: "scroll" | "paged" | "book"; background?: "black" | "paper" | "soft" } => {
    const rawPage = typeof search["page"] === "string" ? Number(search["page"]) : search["page"];
    const mode = search["mode"];
    const background = search["background"];
    return {
      page: typeof rawPage === "number" && Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : undefined,
      mode: mode === "scroll" || mode === "paged" || mode === "book" ? mode : undefined,
      background: background === "black" || background === "paper" || background === "soft" ? background : undefined,
    };
  },
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
  const options = Route.useSearch();
  const { code } = Route.useParams();
  if (!data) return <AccessGate by="code" value={code} />;
  return <EmbeddedVisitor data={data} startPage={options.page} mode={options.mode} background={options.background} />;
}
