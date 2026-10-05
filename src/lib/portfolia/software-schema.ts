import { PRICE } from "./store";

/** The same public plans shown on the homepage and pricing page; no invented ratings. */
export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Portfolia",
  url: "https://portfolia.site/",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web browser",
  description: "Host a PDF portfolio with flipbook viewing, a shareable link, QR code and website embedding.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "GBP", url: "https://portfolia.site/pricing" },
    ...([['Personal monthly', PRICE.month, 'P1M'], ['Personal annual', PRICE.year, 'P1Y']] as const).map(([name, price, billingDuration]) => ({
      "@type": "Offer", name, url: "https://portfolia.site/pricing",
      priceSpecification: { "@type": "UnitPriceSpecification", price: price.replace("£", ""), priceCurrency: "GBP", billingDuration },
    })),
  ],
};
