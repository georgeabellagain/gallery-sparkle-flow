import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { LOCAL_MISSING, Missing, OwnVisitor, useOwn } from "@/components/pf/Visitor";
import { personalActive } from "@/lib/portfolia/store";

/** Local stand-in for <username>.portfolia.site until real subdomains exist. */
export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Portfolio` },
      { name: "description", content: "A portfolio hosted on Portfolia." },
      { property: "og:title", content: `${params.username} — Portfolio` },
      { property: "og:description", content: "A portfolio hosted on Portfolia." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { username } = Route.useParams();
  const p = useOwn((x) => x.username === username);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  if (!p || p.username !== username || !personalActive(p) || p.status !== "published")
    return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <OwnVisitor p={p} preview={false} />;
}
