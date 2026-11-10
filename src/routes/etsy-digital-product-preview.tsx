import { createFileRoute } from "@tanstack/react-router";
import { ProductLanding, productLandingHead } from "@/components/products/ProductLanding";
export const Route = createFileRoute("/etsy-digital-product-preview")({
  staticData: { sitemap: true },
  head: () => productLandingHead("etsy-digital-product-preview"),
  component: () => <ProductLanding page="etsy-digital-product-preview" />,
});
