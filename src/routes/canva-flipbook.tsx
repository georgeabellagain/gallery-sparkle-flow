import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { CanvaArt, CanvaSteps, ClosingUpload, ExampleGallery } from "@/components/pf/TaskExtras";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("canva-flipbook");

export const Route = createFileRoute("/canva-flipbook")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => (
    <SeoLanding
      c={c}
      heroArt={<CanvaArt />}
      uploadLabel="Drop my Canva PDF"
      after={<ClosingUpload title="Your Canva design, turning pages in a minute." body="Download it from Canva as a PDF and drop it here. You see the flipbook straight away, with no sign-up." label="Drop my Canva PDF" />}
    >
      <CanvaSteps />
      <ExampleGallery first="fashion" title="What a finished flipbook looks like" intro="Lookbooks, zines, portfolios and brochures all read as real books. Open one in the live viewer." />
    </SeoLanding>
  ),
});
