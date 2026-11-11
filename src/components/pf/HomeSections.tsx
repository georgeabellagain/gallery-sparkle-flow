import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureClip, MarketingClip, MarketingImage } from "./Media";
import { marketingAsset } from "@/lib/portfolia/marketing-assets";
import { PRODUCT_TICKS } from "@/lib/portfolia/landing-demo";

/* Sections shared by the home page and the SEO pages (plan 2, S3 and S4). Each answers one question and has a
   visual or an action; pictures appear as soon as their files are added to marketing-assets.ts. */

const FRAME = "overflow-hidden rounded-3xl bg-[#e9e8df] shadow-soft";

export const HOME_STEPS = [
  { title: "Drop your PDF", text: "Use the portfolio you already designed in InDesign, Figma, Canva or anything else.", asset: "step-upload" },
  { title: "Make it yours", text: "Studio flipbook, Simple, Scroll or Page by page. Add website links, page tabs and a backdrop.", asset: "step-style" },
  { title: "Share one link", text: "Send it to clients, studios and recruiters, print the QR code, or embed it on your site.", asset: "step-share" },
] as const;

/** "How it works" in three steps, each with its picture once it exists. SEO pages pass their own step text. */
export function HowItWorks({ steps, title = "Online in about a minute", id = "how-it-works" }: { steps?: readonly string[]; title?: string; id?: string }) {
  const items = HOME_STEPS.map((s, i) => ({ ...s, text: steps?.[i] ?? s.text }));
  const extra = steps && steps.length > 3 ? steps.slice(3) : [];
  return <section aria-labelledby={`${id}-title`} className="rule-t">
    <div className="shell max-w-6xl py-16 sm:py-24">
      <p className="label-xs">How it works</p>
      <h2 id={`${id}-title`} className="display-title mt-2 text-3xl sm:text-4xl">{title}</h2>
      <ol className="mt-10 grid gap-8 sm:grid-cols-3">
        {items.map((s, i) => <li key={s.title}>
          {marketingAsset(s.asset) && <div className={`mb-5 aspect-[4/3] ${FRAME}`}><MarketingImage name={s.asset} sizes="(min-width: 640px) 33vw, 100vw" className="h-full w-full object-cover" /></div>}
          <span className="flex size-8 items-center justify-center rounded-full bg-leaf-soft text-sm font-medium text-leaf">{i + 1}</span>
          {!steps && <h3 className="mt-3 text-base font-medium">{s.title}</h3>}
          <p className={steps ? "mt-3 text-[15px] leading-relaxed" : "mt-1 text-[15px] leading-relaxed text-muted-foreground"}>{s.text}</p>
        </li>)}
      </ol>
      {extra.length > 0 && <ol start={4} className="mt-8 grid gap-3 text-[15px] text-muted-foreground">{extra.map((s, i) => <li key={s} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-xs font-medium text-leaf">{i + 4}</span>{s}</li>)}</ol>}
      <Button asChild className="mt-10"><a href="#upload">Try it with your PDF</a></Button>
    </div>
  </section>;
}

/** The four features that sell, each with a picture or clip beside it. */
export function FeatureRows() {
  const rows = [
    { eyebrow: "Studio light", title: "It looks like the real thing", text: "A 3D flipbook lit like a studio photograph, with soft shadows and real paper. Your work feels printed, not pasted.", href: "/hdri-book-visualisation", link: "See the lighting", visual: <FeatureClip name="lighting" alt="A lookbook spread under changing studio light" className="h-full w-full object-cover" /> },
    { eyebrow: "On the page", title: "Things a PDF can’t do", text: "Hotspots and pop-up cards, buttons to your shop, YouTube and Vimeo videos on the page, and small info icons for the details.", href: "/free-pdf-flipbook", link: "See the flipbook features", visual: marketingAsset("feature-hotspots") ? <MarketingClip name="feature-hotspots" className="h-full w-full object-cover" /> : <FeatureClip name="links" alt="Website link icons placed on a portfolio page" className="h-full w-full object-cover" /> },
    { eyebrow: "Reader insights", title: "Know who read it", text: "See visits and downloads on every plan. Personal adds which pages people read and for how long, what they click and where they came from.", href: "/pricing", link: "Compare plans", visual: marketingAsset("feature-insights") ? <MarketingImage name="feature-insights" className="h-full w-full object-cover" /> : null },
    { eyebrow: "Share", title: "Share it anywhere", text: "A permanent link, a QR code and an embed for your own website. Replace the PDF and every link keeps working.", href: "/pdf-qr-code", link: "Make a PDF QR code", visual: <FeatureClip name="share" alt="Copying a portfolio link, QR code and embed code" className="h-full w-full object-cover" /> },
  ];
  return <section aria-labelledby="feature-rows-title" className="rule-t">
    <div className="shell max-w-6xl py-16 sm:py-24">
      <h2 id="feature-rows-title" className="display-title text-3xl sm:text-4xl">Everything a PDF attachment can’t do</h2>
      <div className="mt-12 space-y-16">
        {rows.map((r, i) => <article key={r.title} className={r.visual ? "grid items-center gap-8 lg:grid-cols-2 lg:gap-16" : "max-w-2xl"}>
          {r.visual && <div className={`aspect-[16/10] ${FRAME} ${i % 2 ? "lg:order-2" : ""}`}>{r.visual}</div>}
          <div>
            <p className="label-xs">{r.eyebrow}</p>
            <h3 className="display-title mt-2 text-2xl sm:text-3xl">{r.title}</h3>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{r.text}</p>
            <a href={r.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">{r.link} <ArrowRight aria-hidden className="size-3.5" /></a>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}

const TEASER = [
  { title: "Scarlett Bushell’s lookbook", kind: "Fashion lookbook", img: null, tone: "bg-[#02011e] text-white" },
  { title: "A place to pause", kind: "Architecture", img: "/examples/architecture-cover.webp" },
  { title: "Fieldnotes", kind: "Graphic design", img: "/examples/graphic-design-cover.webp" },
  { title: "Quiet coast", kind: "Photography", img: "/examples/photography-cover.webp" },
] as const;

/** Four real examples, all opening on /examples in the live viewer. */
export function ExamplesTeaser() {
  return <section aria-labelledby="examples-title" className="rule-t">
    <div className="shell max-w-6xl py-16 sm:py-24">
      <p className="label-xs">Real examples</p>
      <h2 id="examples-title" className="display-title mt-2 text-3xl sm:text-4xl">See it with real work</h2>
      <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {TEASER.map(e => <a key={e.title} href="/examples" className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          <span className="block aspect-[600/760] overflow-hidden rounded-3xl bg-[#e9e8df] shadow-soft transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift">
            {e.img ? <img src={e.img} alt={`${e.title}, ${e.kind.toLowerCase()} example cover`} width={720} height={912} loading="lazy" className="h-full w-full object-contain" />
              : <span className={`flex h-full flex-col items-center justify-center gap-2 p-4 text-center ${"tone" in e ? e.tone : ""}`}><span className="display-title text-2xl">{e.title}</span><span className="text-[11px] opacity-70">14-page lookbook</span></span>}
          </span>
          <span className="mt-3 block text-base font-medium">{e.title}</span>
          <span className="text-sm text-muted-foreground">{e.kind}</span>
        </a>)}
      </div>
      <Button asChild variant="line" className="mt-10"><a href="/examples">See all examples</a></Button>
    </div>
  </section>;
}

/** The Digital Product Studio in one band: a picture of the Pink preview once it exists, three ticks, one button. */
export function ProductBand() {
  const picture = marketingAsset("product-preview");
  return <section aria-labelledby="product-band-title" className="bg-muted/30">
    <div className="shell grid max-w-6xl items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
      <div className={`aspect-[16/10] ${FRAME}`}>
        {picture ? <MarketingImage name="product-preview" className="h-full w-full object-cover" />
          : <span className="flex h-full flex-col items-center justify-center gap-2 bg-[#f3d6dc] p-6 text-center text-[#5a2333]"><span className="display-title text-4xl">Pink</span><span className="text-sm">A children’s book, previewed before you buy</span></span>}
      </div>
      <div>
        <p className="label-xs">Digital Product Studio</p>
        <h2 id="product-band-title" className="display-title mt-2 text-3xl sm:text-4xl">Selling a PDF? Let shoppers look inside.</h2>
        <ul className="mt-6 space-y-2 text-[15px]">{PRODUCT_TICKS.map(t => <li key={t} className="flex gap-2"><Check aria-hidden className="mt-1 size-4 shrink-0 text-leaf" />{t}</li>)}</ul>
        <Button asChild className="mt-8"><a href="/digital-product-studio">See how selling works</a></Button>
      </div>
    </div>
  </section>;
}
