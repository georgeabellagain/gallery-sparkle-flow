import { AccessGate } from "@/components/pf/AccessGate";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { CloudVisitor, LOCAL_MISSING, Missing, OwnVisitor, SampleVisitor, useOwn } from "@/components/pf/Visitor";
import { loadPortfolioRoute } from "@/lib/portfolia/public-route";
import { portfolioHead } from "@/lib/portfolia/head";
import { SAMPLE } from "@/lib/portfolia/sample";

export const Route = createFileRoute("/p/$slug")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { preview?: string; demo?: "book" } => ({
    ...(typeof s["preview"] === "string" && s["preview"] ? { preview: s["preview"] } : {}),
    ...(s["demo"] === "book" ? { demo: s["demo"] } : {}),
  }),
  loaderDeps: ({ search }) => ({ preview: Boolean(search.preview) }),
  loader: async ({ params, deps }) => ({
    origin: "https://portfolia.site",
    preview: deps.preview,
    ...(params.slug === "sample" || deps.preview ? { data: null, access: null } : await loadPortfolioRoute("code", params.slug)),
  }),
  notFoundComponent: () => <Missing title="No portfolio here" body={LOCAL_MISSING} />,
  errorComponent: () => <Missing title="Couldn’t load this portfolio" body="Please refresh the page to try again." />,
  head: ({ params, loaderData }) => {
    const sample = params.slug === "sample";
    if (!sample) return portfolioHead(loaderData?.data ?? null, "Portfolio", loaderData?.preview);
    const t = sample ? `${SAMPLE.profile.name} — Fashion Lookbook Example | Portfolia` : "PDF Portfolio — Portfolia";
    const d = sample ? `Example fashion lookbook by ${SAMPLE.profile.name}, ${SAMPLE.profile.title}, hosted on Portfolia.` : "A PDF portfolio hosted on Portfolia.";
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
  const { preview, demo } = Route.useSearch();
  const { data, access } = Route.useLoaderData();
  const p = useOwn((x) => x.code === slug);
  const hydrated = useHydrated();
  if (slug === SAMPLE.code) return <SampleVisitor demo={demo} />;
  if (preview) {
    if (!hydrated) return null;
    if (!p || p.code !== slug) return <Missing title="No portfolio here" body="Sign in on this device to preview your draft." />;
    return <OwnVisitor p={p} preview />;
  }
  if (!data) return <AccessGate by="code" value={slug} initial={access} />;
  return <CloudVisitor data={data} />;
}
