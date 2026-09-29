import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead, type SeoContent } from "@/components/pf/SeoLanding";

const c: SeoContent = {
  path: "/free-pdf-portfolio",
  title: "Free PDF Portfolio Hosting — Upload & Share a Link | Portfolia",
  description: "Upload your PDF portfolio for free and share it with one simple link. No website builder, no ads — a clean full-screen viewer that keeps your layout exactly as designed.",
  h1: "Free PDF portfolio hosting.",
  h1Accent: "Upload once, share one link.",
  intro: "Already designed your portfolio in InDesign, Illustrator or Canva? Upload the PDF and get a clean, shareable link in minutes — free, with no website to build.",
  points: [
    { title: "Your layout, untouched", body: "Pages display exactly as you exported them, with sharp rendering, selectable text and working links." },
    { title: "No email attachments", body: "Send one link instead of a heavy file. Recruiters and clients open it instantly on any device." },
    { title: "Replace without breaking links", body: "Update your PDF whenever you like — your sharing link stays the same." },
  ],
  steps: ["Upload your PDF portfolio (up to 10 MB free).", "Add your name, role and contact links.", "Publish and share your link."],
  faqs: [
    { q: "Is it really free?", a: "Yes. The Free plan hosts one PDF portfolio up to 10 MB with a permanent link, at no cost." },
    { q: "Can visitors download my PDF?", a: "Only if you allow it. Downloading is optional and controlled by you." },
    { q: "Does it work on phones?", a: "Yes. The viewer adapts to phones, tablets and laptops, with scroll or page-by-page reading." },
  ],
};

export const Route = createFileRoute("/free-pdf-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
