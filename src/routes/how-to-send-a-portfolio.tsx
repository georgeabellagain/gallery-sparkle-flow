import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { ClosingUpload, EmailBuilder, ExampleGallery, LinkVsAttachment, SendPortfolioArt } from "@/components/pf/TaskExtras";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("how-to-send-a-portfolio");

export const Route = createFileRoute("/how-to-send-a-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => (
    <SeoLanding
      c={c}
      hideDefaultExample
      heroArt={<SendPortfolioArt />}
      uploadLabel="Get my portfolio link"
      after={<ClosingUpload title="Get the link for your email." body="Drop your portfolio PDF to preview it, publish free, then paste your link into the template above." label="Get my portfolio link" />}
    >
      <EmailBuilder />
      <LinkVsAttachment />
      <ExampleGallery title="What the recipient opens" intro="Every link opens a viewer like these: turn the pages, zoom into detail, no download needed." />
    </SeoLanding>
  ),
});
