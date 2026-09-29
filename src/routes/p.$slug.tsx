import { createFileRoute } from "@tanstack/react-router";
import { useHydrated } from "@tanstack/react-router";
import { CloudVisitor, LOCAL_MISSING, Missing, OwnVisitor, SampleVisitor, useOwn } from "@/components/pf/Visitor";
import { getPublicPortfolio } from "@/lib/portfolia/public.functions";
import { portfolioHead } from "@/lib/portfolia/head";
import { SAMPLE } from "@/lib/portfolia/sample";
import { getRequestOrigin } from "@/lib/origin.functions";

export const Route = createFileRoute("/p/$slug")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { preview?: string } =>
    typeof s["preview"] === "string" && s["preview"] ? { preview: s["preview"] } : {},
  loader: async ({ params }) => ({
    origin: await getRequestOrigin(),
    data: params.slug === "sample" ? null : await getPublicPortfolio({ data: { by: "code", value: params.slug } }),
  }),
  errorComponent: () => <Missing title="Couldn’t load this portfolio" body="Please refresh the page to try again." />,
  head: ({ params, loaderData }) => {
    const sample = params.slug === "sample";
    if (!sample) return portfolioHead(loaderData?.data ?? null, "Portfolio");
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
  const { data } = Route.useLoaderData();
  const p = useOwn((x) => x.code === slug);
  const hydrated = useHydrated();
  if (slug === SAMPLE.code) return <SampleVisitor />;
  if (preview) {
    if (!hydrated) return null;
    if (!p || p.code !== slug) return <Missing title="No portfolio here" body="Sign in on this device to preview your draft." />;
    return <OwnVisitor p={p} preview />;
  }
  if (!data) return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <CloudVisitor data={data} />;
}
