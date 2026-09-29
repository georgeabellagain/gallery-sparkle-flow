import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { LOCAL_MISSING, Missing, OwnVisitor, useOwn } from "@/components/pf/Visitor";
import { personalActive } from "@/lib/portfolia/store";

export const Route = createFileRoute("/$username")({
  staticData: { sitemap: false },
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Portfolio` },
      { name: "description", content: "A personal portfolio hosted on Portfolia." },
      { property: "og:title", content: `${params.username} — Portfolio` },
      { property: "og:description", content: "A personal portfolio hosted on Portfolia." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PersonalPortfolio,
});

function PersonalPortfolio() {
  const { username } = Route.useParams();
  const p = useOwn((portfolio) => portfolio.username === username);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  if (!p || !personalActive(p) || p.status !== "published")
    return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <OwnVisitor p={p} preview={false} />;
}