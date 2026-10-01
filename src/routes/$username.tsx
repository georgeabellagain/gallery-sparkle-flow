import { createFileRoute, useHydrated, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CloudVisitor, LOCAL_MISSING, Missing, useOwn } from "@/components/pf/Visitor";
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
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const own = useOwn((p) => p.code === data?.portfolio.code);
  useEffect(() => {
    if (hydrated && own) void navigate({ to: "/edit", replace: true });
  }, [hydrated, navigate, own]);
  if (!data) return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  if (hydrated && own) return null;
  return <CloudVisitor data={data} />;
}
