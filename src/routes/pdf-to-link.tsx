import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { ClosingUpload, ExampleGallery, PdfToLinkArt, RecipientPreview } from "@/components/pf/TaskExtras";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("pdf-to-link");

export const Route = createFileRoute("/pdf-to-link")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => (
    <SeoLanding
      c={c}
      hideDefaultExample
      heroArt={<PdfToLinkArt />}
      uploadLabel="Turn my PDF into a link"
      after={<ClosingUpload title="Your link is one drop away." body="Preview your PDF as a link-ready page now, with no sign-up. Publish free to get your permanent link and QR code." label="Turn my PDF into a link" />}
    >
      <RecipientPreview />
      <ExampleGallery title="Works for every kind of PDF" intro="Portfolios, photo series, brand books and lookbooks. Open any of these to see exactly what your link opens." />
    </SeoLanding>
  ),
});
