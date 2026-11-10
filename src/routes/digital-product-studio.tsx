import { createFileRoute } from "@tanstack/react-router";
import { ProductLanding, productLandingHead } from "@/components/products/ProductLanding";
export const Route = createFileRoute("/digital-product-studio")({
  staticData: { sitemap: true },
  head: () => productLandingHead("digital-product-studio"),
  component: () => <ProductLanding page="digital-product-studio" />,
});
