import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead } from "@/components/pf/SeoLanding";
import { ProfessionExample } from "@/components/pf/ProfessionExample";
import { ClosingUpload, ExampleGallery, UcasArt, UcasChecklist, UcasUses } from "@/components/pf/TaskExtras";
import { PROFESSION_GUIDES } from "@/lib/portfolia/profession-guides";
import { taskContent } from "@/lib/portfolia/task-pages";

const c = taskContent("ucas-portfolio");

export const Route = createFileRoute("/ucas-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => (
    <SeoLanding
      c={c}
      hideDefaultExample
      heroArt={<UcasArt />}
      uploadLabel="Preview my portfolio"
      after={<ClosingUpload title="Your portfolio, ready for every application." body="Preview it as a book in seconds, with no sign-up. Publish free when you are happy, then use the same link and QR code all the way to interview." label="Preview my portfolio" />}
    >
      <UcasChecklist />
      <ProfessionExample guide={PROFESSION_GUIDES["/architecture-portfolio"]!} />
      <UcasUses />
      <ExampleGallery first="graphic" title="Portfolios across art and design" intro="Open a demonstration portfolio in the live viewer to see how sketchbook pages, final pieces and captions read as a book." />
    </SeoLanding>
  ),
});
