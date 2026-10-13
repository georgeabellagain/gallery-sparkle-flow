import type { SeoContent } from "@/components/pf/SeoLanding";

type Page = Omit<SeoContent, "path"> & { label: string };

const qrFaq = { q: "Can I share it with a QR code?", a: "Yes. Every published portfolio has a downloadable high-resolution QR code for print, cards and displays." };
const sizeFaq = { q: "How large can my PDF be?", a: "Up to 10 MB on Free, or up to 50 MB per portfolio on Personal." };

export const DISCIPLINE_PAGES: Record<string, Page> = {
  "marketing-portfolio": {
    label: "Marketing portfolio",
    title: "Marketing Portfolio — Share Your Campaigns as a Free PDF Flipbook | Portfolia",
    description: "Turn your marketing portfolio PDF into a shareable online flipbook. Present campaign case studies, content and results to employers or clients. Start free.",
    h1: "Your marketing portfolio,", h1Accent: "ready for your next opportunity.",
    intro: "Bring your campaigns, content and case studies together in the PDF you already designed. Upload it to Portfolia and share one portfolio link with employers, agencies and clients.",
    points: [
      { title: "Show the thinking behind the campaign", body: "Keep your brief, audience, strategy and creative work together. Present social media, email, content marketing and brand campaigns in the order that tells your story." },
      { title: "Send people to the relevant work", body: "Add named projects and page ranges, then share a link to a particular case study. Add website-link icons to connect your PDF pages to live campaigns or published content." },
      { title: "Update your work, keep your link", body: "Replace your PDF as you finish new campaigns. Your sharing address stays the same, so applications and client proposals can point to your latest work." },
    ],
    sections: [
      { title: "What should a marketing portfolio include?", body: "Start with a short introduction explaining your specialism and the work you want to do. Choose a focused selection of projects rather than every asset you have produced. For each case study, show the objective, intended audience, your role, the approach and a few examples of the finished work. A social media portfolio might include a content plan and selected posts; an email marketing case study could pair the audience strategy with newsletter layouts; a content marketing project could show an article, landing page or editorial calendar. Explain your own contribution and credit collaborators." },
      { title: "Turn campaign results into clear case studies", body: "Connect each result to the campaign objective. Where you have permission to share them, include relevant measures such as engagement, qualified enquiries or conversions, with the timeframe and baseline needed to understand them. Distinguish results you measured from outcomes you only contributed to. If you cannot disclose client data, describe the method and learning without exposing confidential information. Portfolia presents the PDF you upload; it does not generate campaign reports or verify performance claims." },
      { title: "Build a marketing portfolio without client experience", body: "Students and early-career marketers can include coursework, personal projects, volunteering or a campaign concept. Label speculative work clearly, explain the audience and decisions, and show the deliverables you created. You can discuss how you would measure success without inventing results. Design your case studies in your preferred tool, export them as a PDF and preview them here. Check headings, screenshots and charts on both a phone and a laptop before publishing. Keep the first few pages relevant to the employer or client receiving the link." },
    ],
    checklist: ["Explain the objective, audience and your contribution.", "Label concept work and credit collaborators.", "Share client assets and results only with permission.", "Check text, screenshots and project links on mobile."],
    steps: ["Export your marketing case studies as a PDF from your preferred design tool.", "Upload your PDF, choose a reading style and organise your named projects.", "Publish and share your marketing portfolio link or downloadable QR code."],
    faqs: [
      { q: "How do I create an online marketing portfolio?", a: "Put your introduction and campaign case studies into a PDF, upload it to Portfolia, then publish a sharing link. You can choose Flipbook, Scroll or Page by page reading and add named projects. Portfolia hosts your existing PDF rather than designing the case studies for you." },
      { q: "Can I make a marketing portfolio for free?", a: "Yes. Portfolia's Free plan supports one PDF portfolio up to 10 MB, with a sharing link and downloadable QR code. You can preview your PDF before signing up; an account is needed to save and publish it." },
      { q: "Can I use it for a social media or digital marketing portfolio?", a: "Yes. Your PDF can include social posts, campaign plans, email layouts, content samples and results. Add website-link icons in the editor to send readers to relevant published work." },
      { q: "Can I share a single marketing case study?", a: "Yes. Add a named project and its page range, then copy that project's link. It opens at the project's first page while leaving the rest of your portfolio available." },
      { q: "Can I protect confidential client work?", a: "Personal offers password protection and expiring links. These controls do not replace a client's permission to share their work or data; remove confidential information before uploading." },
      sizeFaq, qrFaq,
    ],
  },
  "fashion-portfolio": {
    label: "Fashion portfolio",
    title: "Fashion Portfolio Website — Share Your PDF Lookbook Free | Portfolia",
    description: "Host your fashion design portfolio or lookbook as a clean full-screen PDF. Share one link or QR code with studios, brands and course admissions.",
    h1: "Your fashion portfolio,", h1Accent: "styled exactly as you designed it.",
    intro: "Illustrations, flats, fabric boards and shoot imagery stay just as you laid them out. Send brands and studios one link instead of a heavy attachment.",
    points: [
      { title: "Lookbooks that feel editorial", body: "A quiet dark viewer lets colour, texture and styling carry the page." },
      { title: "Ready for applications", body: "Paste your link into internship, job and course applications — it opens on any device." },
      { title: "QR codes for shows", body: "Print your QR code on hang tags, show cards or graduate exhibition displays." },
    ],
    steps: ["Export your fashion portfolio or lookbook as a PDF.", "Upload it and add your name, speciality and links.", "Share your link or QR code with brands and studios."],
    faqs: [sizeFaq, qrFaq, { q: "Can I keep a separate lookbook per collection?", a: "Personal lets you host up to 10 portfolios, each with its own link." }],
  },
  "photography-portfolio": {
    label: "Photography portfolio",
    title: "Photography Portfolio Website from Your PDF — Free | Portfolia",
    description: "Share your photography portfolio as a sharp, distraction-free PDF viewer on a dark background. One link or QR code, free to start.",
    h1: "A photography portfolio", h1Accent: "on a calm, dark stage.",
    intro: "Keep your sequencing and edit exactly as you intended. Portfolia shows your PDF full-width on black, so images read at their best.",
    points: [
      { title: "Your edit, your sequence", body: "Pages appear in the order you designed — no automatic cropping or reshuffled grids." },
      { title: "Zoom for detail", body: "Visitors can zoom in on pages to see fine detail." },
      { title: "Choose if it downloads", body: "Downloading your PDF is optional and entirely under your control." },
    ],
    steps: ["Export your photo series or book as a PDF.", "Upload it and add your details and contact links.", "Share one link or QR code with editors and clients."],
    faqs: [sizeFaq, qrFaq, { q: "Will my images be compressed?", a: "Your PDF is shown as uploaded; quality depends on how you export it." }],
  },
  "graphic-design-portfolio": {
    label: "Graphic design portfolio",
    title: "Graphic Design Portfolio Website — Host Your PDF Free | Portfolia",
    description: "Keep your typography and grids pixel-perfect. Upload your graphic design PDF portfolio and share it with one link or QR code.",
    h1: "Graphic design portfolios,", h1Accent: "with every grid intact.",
    intro: "No rebuilding pages block by block in a website builder. Upload the PDF you already designed and share it as a focused online portfolio.",
    points: [
      { title: "Typography stays true", body: "Text remains selectable in Scroll and Page by page modes. Flipbook presents each page as an image." },
      { title: "Working links", body: "Links to live projects or case studies stay clickable in Scroll and Page by page modes. PDF links are not yet clickable in Flipbook." },
      { title: "Replace any time", body: "Upload a new version and your sharing link stays the same." },
    ],
    steps: ["Export your portfolio from InDesign, Illustrator, Figma or Canva.", "Upload it and add your profile.", "Share your link or QR code with studios and clients."],
    faqs: [sizeFaq, qrFaq, { q: "Can I use it instead of a website?", a: "Yes — many designers use one link to a polished PDF as their portfolio site." }],
  },
  "interior-design-portfolio": {
    label: "Interior design portfolio",
    title: "Interior Design Portfolio Website — Share Your PDF | Portfolia",
    description: "Present interior design projects, mood boards and drawings as a clean PDF portfolio. Share with clients and practices by link or QR code.",
    h1: "Interior design portfolios,", h1Accent: "presented beautifully.",
    intro: "Mood boards, plans, elevations and finished spaces stay in the layout you composed — ready to send to clients and practices.",
    points: [
      { title: "Plans and renders together", body: "Detailed drawings stay sharp alongside photography." },
      { title: "Client-ready", body: "Send a clean link that opens on phones, tablets and laptops." },
      { title: "One for each pitch", body: "On Personal, keep up to 10 portfolios for different clients or sectors." },
    ],
    steps: ["Export your interior design portfolio as a PDF.", "Upload it and add your contact details.", "Share your link or QR code with clients."],
    faqs: [sizeFaq, qrFaq],
  },
  "illustration-portfolio": {
    label: "Illustration portfolio",
    title: "Illustration Portfolio Website — Free PDF Hosting | Portfolia",
    description: "Share your illustration portfolio as a clean PDF with one link or QR code. Ideal for agents, publishers and art directors.",
    h1: "Illustration portfolios,", h1Accent: "one simple link.",
    intro: "Send art directors, agents and publishers a focused portfolio that shows your work exactly as you arranged it.",
    points: [
      { title: "Colour on a dark stage", body: "The black viewer background makes artwork stand out." },
      { title: "Page-by-page or scroll", body: "Visitors can read continuously or click through one page at a time." },
      { title: "QR for fairs", body: "Put your QR code on prints, zines and table cards at fairs." },
    ],
    steps: ["Export your illustration portfolio as a PDF.", "Upload it and add your details.", "Share your link or QR code."],
    faqs: [sizeFaq, qrFaq],
  },
  "art-portfolio": {
    label: "Art portfolio",
    title: "Art Portfolio Website — Share Your PDF for Applications | Portfolia",
    description: "Host your art portfolio as a PDF for art school, residency and gallery applications. Share one link or QR code, free to start.",
    h1: "An art portfolio", h1Accent: "ready for any application.",
    intro: "Art schools, residencies and galleries often ask for a portfolio link. Upload your PDF and get one in minutes.",
    points: [
      { title: "Applications made simple", body: "Paste one link into forms instead of wrestling with upload limits." },
      { title: "Artist statement included", body: "Add your name, a short intro and contact links above your work." },
      { title: "Update without breaking links", body: "Replace your PDF as your practice grows — the link stays the same." },
    ],
    steps: ["Export your art portfolio as a PDF.", "Upload it and add your statement and links.", "Share your link or QR code."],
    faqs: [sizeFaq, qrFaq],
  },
  "ux-design-portfolio": {
    label: "UX design portfolio",
    title: "UX Design Portfolio — Share Your PDF Case Studies | Portfolia",
    description: "Share UX and product design case studies as a clean PDF portfolio with one link. Keep your Figma layouts intact.",
    h1: "UX portfolios", h1Accent: "straight from Figma.",
    intro: "Export your case studies from Figma as a PDF and share a focused link with recruiters and hiring managers.",
    points: [
      { title: "Case studies, as designed", body: "Your narrative and layout stay intact — no reformatting for a builder." },
      { title: "Clickable prototypes", body: "Links in your PDF to prototypes or live products work in Scroll and Page by page modes. Switch to one of these modes to open a link." },
      { title: "Know it was opened", body: "Basic visit statistics show when your portfolio has been viewed." },
    ],
    steps: ["Export your case studies from Figma as a PDF.", "Upload it and add your profile and LinkedIn.", "Share your link with recruiters."],
    faqs: [sizeFaq, qrFaq],
  },
  "product-design-portfolio": {
    label: "Product design portfolio",
    title: "Product & Industrial Design Portfolio Website | Portfolia",
    description: "Share your product or industrial design portfolio — sketches, CAD renders and prototypes — as a clean PDF with one link or QR code.",
    h1: "Product design portfolios,", h1Accent: "sketch to final render.",
    intro: "Show your process and outcomes exactly as you laid them out, and share them through one link.",
    points: [
      { title: "Process pages stay intact", body: "Sketches, CAD and photography keep their original composition." },
      { title: "Zoom into details", body: "Visitors can zoom to inspect fine detail." },
      { title: "Share in person", body: "Use your QR code at degree shows and interviews." },
    ],
    steps: ["Export your portfolio as a PDF.", "Upload it and add your details.", "Share your link or QR code."],
    faqs: [sizeFaq, qrFaq],
  },
  "student-portfolio": {
    label: "Student portfolio",
    title: "Student Portfolio for University Applications — Free | Portfolia",
    description: "Share your student portfolio for university, art school and internship applications. Upload your PDF free and get one link or QR code.",
    h1: "Student portfolios,", h1Accent: "free and ready to send.",
    intro: "Applying to university, art school or an internship? Upload your portfolio PDF and share it with a single link — free.",
    points: [
      { title: "Free to start", body: "One portfolio up to 10 MB on the Free plan, with a permanent link." },
      { title: "Works on any device", body: "Admissions tutors can open it on a phone, tablet or laptop." },
      { title: "QR for degree shows", body: "Download your QR code for end-of-year show displays." },
    ],
    steps: ["Export your portfolio as a PDF.", "Upload it and add your name and course.", "Paste your link into applications."],
    faqs: [sizeFaq, qrFaq, { q: "Is it really free?", a: "Yes. The Free plan hosts one PDF portfolio at no cost." }],
  },
  "landscape-architecture-portfolio": {
    label: "Landscape architecture portfolio",
    title: "Landscape Architecture Portfolio Website — PDF Hosting | Portfolia",
    description: "Share your landscape architecture portfolio — masterplans, sections and planting plans — as a sharp PDF with one link or QR code.",
    h1: "Landscape architecture portfolios,", h1Accent: "sharp at every scale.",
    intro: "Masterplans, sections and planting schemes stay crisp and exactly as laid out, ready to send to practices.",
    points: [
      { title: "Large drawings, sharp", body: "Fine line work and labels render clearly, with zoom." },
      { title: "No bounced attachments", body: "Send a link instead of a large file." },
      { title: "Several versions", body: "Personal hosts up to 10 portfolios for different applications." },
    ],
    steps: ["Export your portfolio as a PDF.", "Upload it and add your details.", "Share your link or QR code."],
    faqs: [sizeFaq, qrFaq],
  },
};

export const SEO_LINKS: { to: string; label: string }[] = [
  { to: "/flipbook-alternatives", label: "Compare flipbook tools" },
  { to: "/zine-flipbook", label: "Zine flipbooks" },
  { to: "/magazine-flipbook", label: "Digital magazines" },
  { to: "/free-pdf-flipbook", label: "Free PDF flipbook" },
  { to: "/issuu-alternative", label: "Issuu alternative" },
  { to: "/professional-portfolio", label: "Professional portfolio" },
  { to: "/free-pdf-portfolio", label: "Free PDF portfolio hosting" },
  { to: "/free-portfolio-website", label: "Free portfolio website" },
  { to: "/architecture-portfolio", label: "Architecture portfolio" },
  ...Object.entries(DISCIPLINE_PAGES).map(([slug, p]) => ({ to: `/${slug}`, label: p.label })),
];

export function disciplineContent(slug: string): SeoContent {
  const { label: _l, ...rest } = DISCIPLINE_PAGES[slug]!;
  return { path: `/${slug}`, ...rest };
}

