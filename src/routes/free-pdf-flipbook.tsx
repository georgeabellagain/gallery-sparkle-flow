import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { PUBLISHING_PAGES } from "@/lib/portfolia/publishing-pages";

const c = PUBLISHING_PAGES["free-pdf-flipbook"]!;
export const Route = createFileRoute("/free-pdf-flipbook")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c}><PreparationGuide /></SeoLanding>,
});


function PreparationGuide() {
  return <section className="rule-t"><div className="shell max-w-4xl py-12">
    <h2 className="text-xl font-medium">Prepare a portfolio that is easy to open and read</h2>
    <div className="mt-6 grid gap-7 sm:grid-cols-2">
      {[
        ["Export for the screen", "Keep a high-quality master and export a separate web PDF. Check body text, captions and fine drawings at normal viewing size. Large photographs often account for most of a PDF’s size; reduce their export resolution only as far as your work allows. Free accepts one PDF up to 10 MB and Personal accepts up to 50 MB per portfolio."],
        ["Try compression without flattening the pages", "The optional upload optimiser repacks PDF data locally on your device. It does not rasterise pages or downsample images, so it may make little difference to an image-heavy file. Compare the reported sizes, download the result to review it, then choose which copy to upload. Your original file remains unchanged."],
        ["Choose pages or ready-made spreads", "Check whether your PDF contains individual pages or already-designed double-page spreads before configuring the flipbook. Preview the front cover, a middle spread and the last page. Use Page by page when each sheet needs its own screen, or Scroll for a continuous read."],
        ["Test links in the right reading mode", "PDF links and selectable text work in Scroll and Page by page. Flipbook currently presents rendered page images, so its PDF links are not clickable. Include contact links in your profile and offer a reading mode with clickable links when your portfolio sends people to live projects."],
        ["Check what you are sharing", "Published links work for anyone who has the address, even when search indexing is off. Unlisted is not password-protected. Share only material you are allowed to publish. Inspect the public version on a phone as well as a desktop before adding the link to applications or printed QR cards."],
        ["Keep one address up to date", "Replace a portfolio PDF from the editor to keep its sharing address and embed. Cover previews are generated for shared links, although social platforms may cache an older image. After a replacement, check the first and last pages and allow your account sync to finish before sharing."],
      ].map(([title, text]) => <article key={title}><h3 className="text-base font-medium">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>)}
    </div>
  </div></section>;
}
