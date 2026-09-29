import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead, type SeoContent } from "@/components/pf/SeoLanding";

const c: SeoContent = {
  path: "/free-portfolio-website",
  title: "Free Portfolio Website from Your PDF — No Builder Needed | Portfolia",
  description: "Get a free portfolio website in minutes. Upload your PDF, add your details, then share a personal link or downloadable QR code.",
  h1: "A free portfolio website,",
  h1Accent: "made from your PDF.",
  intro: "Skip templates and drag-and-drop builders. Portfolia turns the portfolio you already have into a focused online page with your details and contact links.",
  points: [
    { title: "Link and QR code included", body: "Share your portfolio online or download its personal QR code for business cards, exhibitions and applications." },
    { title: "Made for creatives", body: "A quiet, full-screen viewer puts your work first — no ads or distracting menus." },
    { title: "Grow when you need to", body: "Personal adds up to 10 portfolios, a CV and a personalised address like portfolia.site/marksmith." },
  ],
  steps: ["Export your portfolio as a PDF.", "Upload it and add your profile.", "Publish your free portfolio website and share its link or QR code."],
  faqs: [
    { q: "Do I need design or coding skills?", a: "No. If you have a PDF, you have everything you need." },
    { q: "Can I use it for job applications?", a: "Yes. Paste your link into applications, emails or LinkedIn — it opens on any device." },
    { q: "Will my portfolio appear on Google?", a: "Search indexing is off by default. You can turn it on for your portfolio if you want it found." },
    { q: "Can I put my portfolio QR code on a business card?", a: "Yes. Download the high-resolution PNG from your dashboard and use it in print or digital materials." },
  ],
};

export const Route = createFileRoute("/free-portfolio-website")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
