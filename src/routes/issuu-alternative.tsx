import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { PUBLISHING_PAGES } from "@/lib/portfolia/publishing-pages";

const c = PUBLISHING_PAGES["issuu-alternative"]!;
export const Route = createFileRoute("/issuu-alternative")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c}><Comparison /></SeoLanding>,
});


function Comparison() {
  return <section className="rule-t">
    <div className="shell max-w-4xl py-12">
      <h2 className="text-xl font-medium">Compare the workflow you need</h2>
      <p className="mt-3 text-sm text-muted-foreground">Portfolia is built for sharing a finished portfolio with clients, recruiters and course admissions. Try it with your own PDF before moving an existing publication.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Portfolia and Issuu portfolio sharing comparison</caption>
          <thead className="bg-muted"><tr><th scope="col" className="p-4">What matters</th><th scope="col" className="p-4">Portfolia</th><th scope="col" className="p-4">Issuu</th></tr></thead>
          <tbody>
            {[
              ["Getting started", "One portfolio up to 10 MB on Free. Preview before signing in.", "Check the current plan’s publication and file limits before uploading."],
              ["Website embedding", "Included on Free, with a copyable embed code.", "Embedding requires a paid plan, according to Squarespace’s integration guide."],
              ["Reading experience", "Simple and 3D Studio flipbooks, Scroll and Page by page.", "An embedded publication reader; try your document to compare its presentation."],
              ["Links within the PDF", "Clickable in Scroll and Page by page; not yet clickable in Flipbook.", "Check link behaviour in the reader and plan you intend to use."],
              ["Sharing your work", "A stable portfolio link and a downloadable QR code.", "Publications can be embedded in a website using Issuu’s embed code."],
            ].map(([feature, portfolia, issuu]) => <tr key={feature} className="border-t border-border"><th scope="row" className="p-4 align-top font-medium">{feature}</th><td className="p-4 align-top">{portfolia}</td><td className="p-4 align-top">{issuu}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Embedding reference checked 5 October 2026: <a className="underline underline-offset-4" href="https://support.squarespace.com/hc/en-us/articles/206545267-Using-Issuu-with-Squarespace">Squarespace’s Issuu integration guide</a>. See <a className="underline underline-offset-4" href="https://issuu.com/pricing">Issuu’s current plans</a> for prices, billing terms and limits. Portfolia is independent of Issuu.</p>
      <h2 className="mt-9 text-lg font-medium">Moving an existing portfolio</h2>
      <p className="mt-3 text-sm text-muted-foreground">Upload your original PDF, review every page and test your contact links in your chosen reading mode. Publish it, then update the links in your CV, website and applications. An old Issuu address does not redirect automatically to Portfolia.</p>
      <h2 className="mt-7 text-lg font-medium">When to compare more than the viewer</h2>
      <p className="mt-3 text-sm text-muted-foreground">If you need publication sales, a discovery audience, team workflows or detailed engagement reporting, compare those requirements separately. Portfolia currently provides basic visit statistics and direct portfolio sharing; it has no public discovery gallery. Unlisted links are accessible to anyone who has them and are not password protection.</p>
      <a href="/pricing" className="mt-5 inline-block text-sm underline underline-offset-4">See Portfolia’s Free and Personal plans</a>
    </div>
  </section>;
}
