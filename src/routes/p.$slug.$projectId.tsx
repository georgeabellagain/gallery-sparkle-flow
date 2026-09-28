import { createFileRoute } from "@tanstack/react-router";
import { PublishedPage } from "@/components/portfolia/PublishedPage";

export const Route = createFileRoute("/p/$slug/$projectId")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    const title = `Project — ${name} · Portfolia`;
    const description = `A project inside the portfolio published at /p/${params.slug}.`;
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
    const { slug, projectId } = Route.useParams();
    const { preview } = Route.useSearch();
    return <PublishedPage slug={slug} projectId={projectId} preview={preview} />;
  },
});
