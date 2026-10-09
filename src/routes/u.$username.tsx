import { AccessGate } from "@/components/pf/AccessGate";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { CloudVisitor, LOCAL_MISSING, Missing } from "@/components/pf/Visitor";
import { loadPortfolioRoute } from "@/lib/portfolia/public-route";
import { personalActive } from "@/lib/portfolia/store";
import { portfolioHead } from "@/lib/portfolia/head";

/** Legacy personalised address retained for previously shared links. */
export const Route = createFileRoute("/u/$username")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const result = await loadPortfolioRoute("username", params.username.toLowerCase());
    if (result.data && !personalActive(result.data.portfolio)) throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => portfolioHead(loaderData?.data ?? null, params.username),
  errorComponent: () => <Missing title="Couldn’t load this portfolio" body="Please refresh the page to try again." />,
  notFoundComponent: () => <Missing title="No portfolio here" body={LOCAL_MISSING} />,
  component: Page,
});

function Page() {
  const { data, access } = Route.useLoaderData();
  const { username } = Route.useParams();
  if (!data) return <AccessGate by="username" value={username} initial={access} />;
  return <CloudVisitor data={data} />;
}
