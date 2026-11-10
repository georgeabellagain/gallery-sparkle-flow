import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/products/ProductEditor";
export const Route = createFileRoute("/product-studio/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [{ title: "Digital Product Studio — Portfolia" }, { name: "robots", content: "noindex" }],
  }),
  component: () => {
    const { id } = Route.useParams();
    return <ProductEditor key={id} id={id} />;
  },
});
