import { createFileRoute } from "@tanstack/react-router";
import { useHydrated } from "@tanstack/react-router";
import { LOCAL_MISSING, Missing, OwnVisitor, SampleVisitor, useOwn } from "@/components/pf/Visitor";
import { SAMPLE } from "@/lib/portfolia/sample";
import { getRequestOrigin } from "@/lib/origin.functions";

export const Route = createFileRoute("/p/$slug")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { preview?: string } =>
    typeof s["preview"] === "string" && s["preview"] ? { preview: s["preview"] } : {},
  loader: async () => ({ origin: await getRequestOrigin() }),
  head: ({ params, loaderData }) => {
    const sample = params.slug === "sample";
    const t = sample ? `${SAMPLE.profile.name} — Architecture PDF Portfolio Example | Portfolia` : "PDF Portfolio — Portfolia";
    const d = sample ? `Example architecture PDF portfolio by ${SAMPLE.profile.name}, ${SAMPLE.profile.title}, hosted on Portfolia.` : "A PDF portfolio hosted on Portfolia.";
    const o = loaderData?.origin ?? "";
    const img = sample && o ? [{ property: "og:image", content: `${o}/og-image.jpg` }, { name: "twitter:image", content: `${o}/og-image.jpg` }] : [];
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        ...img,
        { name: "robots", content: "noindex, nofollow" },
      ],
      scripts: sample
        ? [{
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              mainEntity: { "@type": "Person", name: SAMPLE.profile.name, jobTitle: SAMPLE.profile.title, description: SAMPLE.profile.intro },
            }),
          }]
        : [],
    };
  },
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { preview } = Route.useSearch();
  const p = useOwn((x) => x.code === slug);
  const hydrated = useHydrated();
  if (slug === SAMPLE.code) return <SampleVisitor />;
  if (!hydrated) return null;
  if (!p || p.code !== slug || (p.status !== "published" && !preview))
    return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <OwnVisitor p={p} preview={Boolean(preview)} />;
}
