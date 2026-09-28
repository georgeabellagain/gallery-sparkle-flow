import { createFileRoute } from "@tanstack/react-router";
import { useHydrated } from "@tanstack/react-router";
import { LOCAL_MISSING, Missing, OwnVisitor, SampleVisitor, useOwn } from "@/components/pf/Visitor";
import { SAMPLE } from "@/lib/portfolia/sample";

export const Route = createFileRoute("/p/$slug")({
  validateSearch: (s: Record<string, unknown>): { preview?: string } =>
    typeof s["preview"] === "string" && s["preview"] ? { preview: s["preview"] } : {},
  head: ({ params }) => {
    const t = params.slug === "sample" ? `${SAMPLE.profile.name} — Portfolio` : "Portfolio — Portfolia";
    const d = params.slug === "sample" ? SAMPLE.profile.title : "A portfolio hosted on Portfolia.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { preview } = Route.useSearch();
  const p = useOwn();
  const hydrated = useHydrated();
  if (slug === SAMPLE.code) return <SampleVisitor />;
  if (!hydrated) return null;
  if (!p || p.code !== slug || (p.status !== "published" && !preview))
    return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <OwnVisitor p={p} preview={Boolean(preview)} />;
}
