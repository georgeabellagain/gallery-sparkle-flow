import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead, type SeoContent } from "@/components/pf/SeoLanding";

const c: SeoContent = {
  path: "/free-pdf-portfolio",
  title: "Free PDF Portfolio Hosting with Link & QR Code | Portfolia",
  description: "Upload your PDF portfolio free and share it through one simple link or a downloadable personal QR code. Keep your original layout in a clean full-screen viewer.",
  h1: "Free PDF portfolio hosting.",
  h1Accent: "Upload once, share one link.",
  intro: "Already designed your portfolio in InDesign, Illustrator or Canva? Upload the PDF and get a clean, shareable link in minutes — free, with no website to build.",
  points: [
    { title: "Your layout, untouched", body: "Pages display exactly as you exported them, with sharp rendering, selectable text and working links." },
    { title: "Share by link or QR code", body: "Send one link or download your personal portfolio QR code for cards, displays and printed applications." },
    { title: "Replace without breaking links", body: "Update your PDF whenever you like — your sharing link stays the same." },
  ],
  steps: ["Upload your PDF portfolio (up to 10 MB free).", "Add your name, role and contact links.", "Publish, then share your link or download its QR code."],
  faqs: [
    { q: "Is it really free?", a: "Yes. The Free plan hosts one PDF portfolio up to 10 MB with a permanent link, at no cost." },
    { q: "Can visitors download my PDF?", a: "Only if you allow it. Downloading is optional and controlled by you." },
    { q: "Does it work on phones?", a: "Yes. The viewer adapts to phones, tablets and laptops, with scroll or page-by-page reading." },
    { q: "Can I get a QR code for my portfolio?", a: "Yes. Every published portfolio includes a personal QR code you can download as a high-resolution PNG and share or print." },
  ],
};

export const Route = createFileRoute("/free-pdf-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
