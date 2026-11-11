import { MarketingHeader, SiteFooter } from "@/components/pf/Chrome";
import { LandingHero } from "@/components/pf/LandingHero";
import { LandingUploadBar } from "@/components/pf/LandingUploadBar";
import { HERO_INTRO_MAX_CHARS, landingCopy } from "@/lib/portfolia/landing-demo";
import { ogImageUrl } from "@/lib/portfolia/marketing-assets";
export const PRODUCT_PAGES = {
  "digital-product-studio": {
    title: "Digital Product Studio: PDF Previews & Customer Editions | Portfolia",
    description:
      "Create interactive PDF product previews, private customer editions and listing videos. Present digital books and zines with Portfolia Digital Product Studio.",
    eyebrow: "Portfolia / Digital Product Studio",
    heading: "Give your digital product",
    accent: "a better first impression.",
    intro:
      "A preview that invites people in. A complete edition for your customers. Turn your PDF into a book worth opening.",
    detail:
      "Upload your complete PDF, choose the pages shoppers can see, and style an interactive booklet. Keep checkout with your existing shop and deliver customer access through a private link.",
    steps: [
      "Upload the complete PDF privately.",
      "Choose specific pages and generate a separate public preview.",
      "Style your booklet and create marketing visuals.",
      "Give buyers a customer link, with an optional PDF download.",
    ],
  },
  "etsy-digital-product-preview": {
    title: "Etsy Digital Product Previews & Delivery PDFs | Portfolia",
    description:
      "Show selected pages of your Etsy digital book, create listing visuals and deliver an interactive customer edition with a downloadable access PDF.",
    eyebrow: "For independent Etsy sellers",
    heading: "Let shoppers look inside",
    accent: "before they buy.",
    intro:
      "Turn your digital book or zine into an interactive preview. Give customers an online edition alongside your shop's digital delivery.",
    detail:
      "Portfolia works alongside Etsy's file delivery. Generate a customer-access PDF in Portfolia and attach it to your digital listing. Etsy delivers that file after purchase; the buyer clicks through to their edition. No Etsy account connection is required.",
    steps: [
      "Create a public preview and link its Buy button to your Etsy listing.",
      "Create a shared customer link and download its delivery PDF.",
      "Attach the delivery PDF to your Etsy digital listing and explain what the purchase includes.",
      "Download a preview video or product image for your listing with Personal.",
    ],
  },
  "digital-zine-publishing": {
    title: "Digital Zine Publishing: Previews, Readers & Downloads | Portfolia",
    description:
      "Publish your digital zine with an interactive preview and private customer edition. Choose sample pages, create book visuals and offer a PDF download.",
    eyebrow: "For zine makers, artists and independent publishers",
    heading: "Your zine deserves",
    accent: "more than an attachment.",
    intro:
      "Preserve your designed pages in an interactive booklet, with a sample for curious readers and a full edition for your supporters.",
    detail:
      "Use individual PDF pages or precomposed spreads. Choose a loose flipbook, soft cover or hardback appearance, then add paper texture and lighting. The reader presents your design; it does not reformat it into EPUB or validate it for print.",
    steps: [
      "Upload your finished PDF and choose its page layout.",
      "Select a cover, sample spread or any other pages for the public preview.",
      "Link to your existing shop and create customer access.",
      "Offer the full PDF download and export preview-only marketing visuals.",
    ],
  },
} as const;
export type ProductPageKey = keyof typeof PRODUCT_PAGES;
export function productLandingHead(key: ProductPageKey) {
  const c = PRODUCT_PAGES[key],
    url = `https://portfolia.site/${key}`;
  return {
    meta: [
      { title: c.title },
      { name: "description", content: c.description },
      { property: "og:title", content: c.title },
      { property: "og:description", content: c.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:image", content: ogImageUrl("og-products", "https://portfolia.site/og-image.jpg") },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: c.title,
          description: c.description,
          url,
        }),
      },
    ],
  };
}
export function ProductLanding({ page }: { page: ProductPageKey }) {
  const c = PRODUCT_PAGES[page];
  return (
    <div className="min-h-screen">
      <MarketingHeader uploadHere />
      <main>
        <LandingHero
          eyebrow={landingCopy(`/${page}`).eyebrow}
          heading={<>{c.heading}<br /><em>{c.accent}</em></>}
          intro={c.intro}
          demo="product"
          upload="product"
          ticks={landingCopy(`/${page}`).ticks}
          secondary={<p className="text-sm"><a href="/products" className="underline underline-offset-4">Open Digital Product Studio</a></p>}
        />
        <LandingUploadBar name={c.title.split("|")[0]!.trim()} />
        {c.intro.length > HERO_INTRO_MAX_CHARS && <section className="rule-t"><div className="shell max-w-4xl py-10"><p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{c.intro}</p></div></section>}
        <section className="border-y bg-muted/30">
          <div className="shell py-12">
            <h2 className="display-title text-3xl">From PDF to product experience.</h2>
            <p className="mt-4 max-w-3xl text-muted-foreground leading-relaxed">{c.detail}</p>
            <ol className="grid md:grid-cols-4 gap-7 mt-9">
              {c.steps.map((s, i) => (
                <li key={s}>
                  <span className="text-xs text-muted-foreground">0{i + 1}</span>
                  <p className="mt-3 text-sm leading-relaxed">{s}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="shell py-14 grid md:grid-cols-3 gap-8">
          {[
            [
              "A real preview boundary",
              "Your public sample is a separate document containing only the pages you choose. The complete PDF is never sent to preview visitors.",
            ],
            [
              "Control customer access",
              "Create labelled links with optional expiry and revoke future access when needed. Links can be forwarded; this is access control, not DRM or automatic purchase verification.",
            ],
            [
              "Marketing from your sample",
              "Create listing videos and staged book images using only the preview. Personal includes HD exports; the complete unpublished pages stay out of your marketing assets.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <h2 className="font-medium text-lg">{t}</h2>
              <p className="text-sm leading-relaxed mt-3 text-muted-foreground">{b}</p>
            </div>
          ))}
        </section>
        {/* Plan 1: what each paid plan adds, matching the comparison in lib/portfolia/plans.ts. */}
        <section className="shell max-w-4xl pb-16">
          <h2 className="display-title text-3xl">Also in the studio</h2>
          <ul className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["Your own address", "portfolia.site/product/your-title, with a QR code and an embed for your website. Personal and Business."],
              ["Statistics", "Preview views, Buy clicks, customer opens and downloads. Counts only, no tracking of shoppers. Personal and Business."],
              ["Buyer name on downloads", "A small “Licensed to …” line on every page of a customer’s PDF. A deterrent, not copy protection. Personal and Business."],
              ["Extra files", "Up to five ZIP, EPUB, PNG, JPG, MP3 or TXT files that only customers can download. Personal and Business."],
              ["Automatic delivery", "Gumroad, Shopify or Zapier tell Portfolia about each order and the buyer is emailed their own private link. Business."],
            ].map(([t, b]) => (
              <li key={t}>
                <span className="font-medium">{t}</span>
                <span className="block text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="shell max-w-3xl pb-16">
          <h2 className="display-title text-3xl mb-6">Before you publish</h2>
          {[
            [
              "Does Portfolia take payments for my products?",
              "No. Link to your existing shop for checkout. You manage orders, refunds and customer support there; Portfolia provides the reader, previews and customer delivery.",
            ],
            [
              "Is this an automatic Etsy integration?",
              "No. Etsy has no simple way to tell other services about an order, so Etsy sellers use the delivery PDF: Etsy delivers the PDF you upload to the listing, and Portfolia does not verify Etsy purchases. On Business, Gumroad, Shopify and tools such as Zapier can send each buyer their own private link automatically.",
            ],
            [
              "Can buyers keep a copy?",
              "Yes, if you enable the customer PDF download. Even with downloads disabled, content shown in a browser can be copied or captured. Revocation cannot erase copies already saved.",
            ],
            [
              "What happens when I revoke a shop link?",
              "Everyone who received that link loses future access. Update the delivery PDF in your shop and arrange replacement access for existing customers. Use separate links if you need to revoke individual orders.",
            ],
            [
              "Is it free?",
              "You can build one product and see exactly how its preview will look on the Free plan. Publishing it, the public preview link and private customer links are part of Personal and Business, alongside everything those plans add for portfolios.",
            ],
            [
              "Can I still make a portfolio?",
              "Yes. Portfolios and Products have separate workspaces and sharing flows. Your existing portfolios and links stay unchanged.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="border-b py-5">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="text-sm leading-relaxed text-muted-foreground mt-3">{a}</p>
            </details>
          ))}
          <p className="text-xs text-muted-foreground mt-6">
            Portfolia is independent of Etsy, Inc. Etsy is a trademark of Etsy, Inc. No endorsement
            or certification is implied.
          </p>
          <nav aria-label="Digital product guides" className="flex flex-wrap gap-4 mt-8 text-sm">
            {Object.entries(PRODUCT_PAGES)
              .filter(([key]) => key !== page)
              .map(([key, value]) => (
                <a className="underline" key={key} href={`/${key}`}>
                  {value.eyebrow}
                </a>
              ))}
          </nav>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
