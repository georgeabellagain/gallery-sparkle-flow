import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
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
      { property: "og:image", content: "https://portfolia.site/og-image.jpg" },
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
      <SiteHeader
        right={
          <>
            <a href="/pricing" className="hidden underline-offset-4 hover:underline sm:inline">Pricing</a>
            <a href="/products" className="underline-offset-4 hover:underline">My products</a>
          </>
        }
      />
      <main>
        <section className="shell py-16 sm:py-24 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{c.eyebrow}</p>
            <h1 className="display-title text-4xl sm:text-6xl leading-tight mt-5">
              {c.heading}
              <br />
              <em>{c.accent}</em>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mt-6 max-w-xl">{c.intro}</p>
            <Button asChild className="mt-8">
              <a href="/products">Open Digital Product Studio</a>
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Try it free · publish with Personal · no shop connection required
            </p>
          </div>
          <div className="rounded-[2rem] bg-[#ece9df] p-7 sm:p-10 border">
            <div className="bg-background rounded-2xl p-6 shadow-soft border">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Public preview
              </span>
              <div className="grid grid-cols-2 mt-5 gap-1" aria-hidden>
                <div className="aspect-[3/4] bg-[#66745e] p-4 flex flex-col justify-between text-white">
                  <span className="text-xs">VOL. 01</span>
                  <span className="font-serif text-3xl italic">
                    Small
                    <br />
                    stories.
                  </span>
                </div>
                <div className="aspect-[3/4] bg-[#e0c0a1] p-4 flex items-end">
                  <span className="text-sm">
                    A few pages.
                    <br />A reason to read on.
                  </span>
                </div>
              </div>
              <div className="mt-5 border-t pt-4 flex justify-between text-xs">
                <span>Selected pages only</span>
                <span>View in your browser →</span>
              </div>
            </div>
            <div className="bg-foreground text-background rounded-xl p-5 mt-4 flex justify-between text-sm">
              <span>Customer edition</span>
              <span>Read · Download</span>
            </div>
          </div>
        </section>
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
        <section className="shell max-w-3xl pb-16">
          <h2 className="display-title text-3xl mb-6">Before you publish</h2>
          {[
            [
              "Does Portfolia take payments for my products?",
              "No. Link to your existing shop for checkout. You manage orders, refunds and customer support there; Portfolia provides the reader, previews and customer delivery.",
            ],
            [
              "Is this an automatic Etsy integration?",
              "No API connection is needed for the delivery-PDF workflow. Etsy delivers the PDF you upload to the listing. Portfolia does not automatically verify purchases or send individual links per Etsy order.",
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
