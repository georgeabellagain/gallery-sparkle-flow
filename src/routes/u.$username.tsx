import { createFileRoute, useHydrated, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CloudVisitor, LOCAL_MISSING, Missing, useOwn } from "@/components/pf/Visitor";
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
