import { AccessGate } from "@/components/pf/AccessGate";
import { createFileRoute } from "@tanstack/react-router";
import { CloudVisitor, LOCAL_MISSING, Missing } from "@/components/pf/Visitor";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import { personalActive, RESERVED } from "@/lib/portfolia/store";
import { portfolioHead } from "@/lib/portfolia/head";

export const Route = createFileRoute("/$username")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    const u = params.username.toLowerCase();
    if (RESERVED.includes(u)) return { data: null };
    const data = await getPublicPortfolio({ data: { by: "username", value: u } });
    return { data: data && personalActive(data.portfolio) ? data : null };
  },
  head: ({ loaderData, params }) => portfolioHead(loaderData?.data ?? null, params.username),
  errorComponent: () => <Missing title="Couldn’t load this portfolio" body="Please refresh the page to try again." />,
  notFoundComponent: () => <Missing title="No portfolio here" body={LOCAL_MISSING} />,
  component: PersonalPortfolio,
});

function PersonalPortfolio() {
  const { data } = Route.useLoaderData();
  const { username } = Route.useParams();
  if (!data) return <AccessGate by="username" value={username} />;
  return <CloudVisitor data={data} />;
}
