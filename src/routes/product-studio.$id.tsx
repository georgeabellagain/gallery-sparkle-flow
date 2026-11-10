import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/products/ProductEditor";
export const Route = createFileRoute("/product-studio/$id")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Edit product — Portfolia Digital Product Studio" },
      { name: "description", content: "Edit your digital product's book, public preview pages and customer access on Portfolia." },
      { property: "og:title", content: "Edit product — Portfolia" },
      { property: "og:description", content: "Edit your digital product's book, public preview pages and customer access on Portfolia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { id } = Route.useParams();
    return <ProductEditor key={id} id={id} />;
  },
});
