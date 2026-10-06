import { AccessGate } from "@/components/pf/AccessGate";
import { createFileRoute } from "@tanstack/react-router";
import { CloudVisitor, LOCAL_MISSING, Missing } from "@/components/pf/Visitor";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import { personalActive } from "@/lib/portfolia/store";
import { portfolioHead } from "@/lib/portfolia/head";

/** Legacy personalised address retained for previously shared links. */
export const Route = createFileRoute("/u/$username")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const data = await getPublicPortfolio({ data: { by: "username", value: params.username } });
    return { data: data && personalActive(data.portfolio) ? data : null };
  },
  head: ({ loaderData, params }) => portfolioHead(loaderData?.data ?? null, params.username),
  errorComponent: () => <Missing title="Couldn’t load this portfolio" body="Please refresh the page to try again." />,
  component: Page,
});

function Page() {
  const { data } = Route.useLoaderData();
  const { username } = Route.useParams();
  if (!data) return <AccessGate by="username" value={username} />;
  return <CloudVisitor data={data} />;
}
