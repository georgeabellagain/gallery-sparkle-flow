import { createFileRoute } from "@tanstack/react-router";
import { SeoLanding, seoHead, type SeoContent } from "@/components/pf/SeoLanding";
const content: SeoContent = {
  path: "/book-marketing",
  title: "Book Marketing Mockups & HD Flipbook Videos | Portfolia",
  description: "Turn your book PDF into an interactive 3D preview before printing. Share sample pages, add a purchase link and download an HD book flip-through video with Personal.",
  h1: "Show your book,", h1Accent: "before it goes to print.",
  intro: "Turn your finished PDF or sample chapters into a shareable book preview. Present illustrated pages in Studio lighting, send readers to your purchase page and create a promotional flip-through video with Personal.",
  points: [
    { title: "A preview readers can explore", body: "Upload selected pages from a children's book, photobook, cookbook, comic or novel. Visitors turn pages or use a flat reading view." },
    { title: "Light it your way", body: "Preview every HDRI and background. Save four lighting environments and two backgrounds on Free; Personal unlocks the full collection and uploaded backgrounds." },
    { title: "From a sample to a sale", body: "Add a book description and a Buy the book link pointing to Amazon, your publisher or your own shop. Personal includes a downloadable 1080p HD flip-through video." },
  ],
  steps: ["Export only the PDF pages you want readers to see. Keep the full manuscript private if you are sharing a sample.", "Upload your PDF, open Book marketing and add your description and purchase link.", "Preview lighting and backgrounds, then Save and publish. Share your link, QR code or embed; use Personal to export an HD video."],
  sections: [
    { title: "Promote a book before ordering printed copies", body: "A digital preview can help you introduce a forthcoming title, share a sample with potential readers or present a book concept to collaborators. Studio adds a physical page-turning presentation without a photo shoot. It is a visual approximation rather than a simulation of your exact binding, paper stock or printed colours." },
    { title: "Using Portfolia alongside Amazon KDP", body: "Create your manuscript and cover in your usual design tools, then upload an interior or sample PDF here for marketing. Portfolia does not submit books to Amazon or validate print-ready files. Use KDP's own Print Previewer and cover calculator to check print dimensions, bleed, margins and spine measurements before publishing." },
    { title: "Free to share; Personal for promotional video", body: "Free includes one PDF up to 10 MB, a purchase link, QR code and embedding. Personal includes up to ten portfolios with PDFs up to 50 MB each, the full lighting/background collection and HD video download. Your draft changes stay private until you save." },
  ],
  faqs: [
    { q: "Can I sell books through Portfolia?", a: "You can link readers to an external shop or Amazon listing. Portfolia does not take customer orders, process book purchases or deliver purchased ebooks." },
    { q: "Does it work before my book is printed?", a: "Yes. You only need a PDF. Use a sample if you do not want your full book publicly available." },
    { q: "Can I create a book marketing video?", a: "Personal lets you download a 1080p Studio flip-through video. MP4 at 60 FPS is available in supported browsers, with a WebM fallback." },
    { q: "Does it create an exact 3D paperback or hardback?", a: "Currently it presents your PDF as a turning booklet. Separate spine artwork, exact binding dimensions and hardback cover modelling are not supported." },
  ],
};
export const Route = createFileRoute("/book-marketing")({ staticData: { sitemap: true }, head: () => seoHead(content), component: () => <SeoLanding c={content} /> });
