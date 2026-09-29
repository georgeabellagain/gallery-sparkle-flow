import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead, type SeoContent } from "@/components/pf/SeoLanding";

const c: SeoContent = {
  path: "/architecture-portfolio",
  title: "Architecture Portfolio Website — Host Your PDF Free | Portfolia",
  description: "Share your architecture portfolio as a crisp PDF viewer with one link or QR code. Built for architects and students applying to practices and courses.",
  h1: "Your architecture portfolio,",
  h1Accent: "online in one link.",
  intro: "Drawings, plans and renders stay sharp and exactly as laid out. Send practices a link instead of a 40 MB attachment that bounces.",
  points: [
    { title: "Sharp drawings", body: "Line work and fine text render crisply, with zoom for detailed plans and sections." },
    { title: "Share beyond email", body: "Use one link in applications or download a QR code for portfolios, business cards and degree shows." },
    { title: "Know it was opened", body: "Basic visit statistics show when your portfolio has been viewed." },
  ],
  steps: ["Export your architecture portfolio from InDesign as a PDF.", "Upload it and add your name, qualifications and links.", "Share your link or QR code with practices and schools."],
  faqs: [
    { q: "What file size can I upload?", a: "Up to 10 MB free, or up to 50 MB per portfolio on Personal — useful for image-heavy architecture work." },
    { q: "Can I keep separate portfolios for different applications?", a: "Personal lets you host up to 10 portfolios, each with its own link." },
    { q: "Can I include my CV?", a: "Yes — on Personal your CV appears alongside your profile." },
    { q: "Can I print a QR code for my degree show?", a: "Yes. Every portfolio has a downloadable high-resolution QR code that opens its public page." },
  ],
};

export const Route = createFileRoute("/architecture-portfolio")({
  staticData: { sitemap: true },
  head: () => seoHead(c),
  component: () => <SeoLanding c={c} />,
});
