import { createFileRoute } from "@tanstack/react-router";
import { PublishedPage } from "@/components/portfolia/PublishedPage";

export const Route = createFileRoute("/p/$slug/")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    const title = `${name} — Portfolia`;
    const description = `A portfolio published with Portfolia at /p/${params.slug}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: () => {
    const { slug } = Route.useParams();
    const { preview } = Route.useSearch();
    return <PublishedPage slug={slug} projectId={null} preview={preview} />;
  },
});
