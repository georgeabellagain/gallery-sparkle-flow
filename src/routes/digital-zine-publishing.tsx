import { createFileRoute } from "@tanstack/react-router";
import { ProductLanding, productLandingHead } from "@/components/products/ProductLanding";
export const Route = createFileRoute("/digital-zine-publishing")({
  staticData: { sitemap: true },
  head: () => productLandingHead("digital-zine-publishing"),
  component: () => <ProductLanding page="digital-zine-publishing" />,
});
