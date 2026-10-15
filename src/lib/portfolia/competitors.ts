import type { SeoContent } from "@/components/pf/SeoLanding";
import { PRICE } from "./store";

export type ComparisonRow = { topic: string; portfolia: string; other: string; source: number };
export type Competitor = {
  name: string; slug: string; intro: string; focus: string; choose: string;
  price: string; rows: ComparisonRow[]; sources: { label: string; url: string }[];
  question: { q: string; a: string };
};
export const COMPARISON_CHECKED = "11 October 2026";
export const COMPETITORS: Competitor[] = [
  {
    name: "Issuu", slug: "issuu-alternative",
    intro: "Already sharing your portfolio on Issuu? Compare the cost of embedding and the way your work is presented before moving. Portfolia gives a finished PDF its own portfolio link, with Simple, Studio, Scroll and Page by page viewing.",
    focus: "If your main goal is to put a portfolio inside your own website, embed permission matters as much as page turns. Squarespace’s current Issuu guide says embedding requires a paid Issuu plan. Portfolia includes website embedding on Free, so you can test your actual portfolio without paying for that step.",
    choose: "Keep an existing publication where it is if its wider publishing workflow already meets your needs. Try Portfolia when the priority is a personal presentation for applications, clients or an exhibition, and compare your original PDF in both readers before switching.",
    price: "Issuu’s live pricing could not be independently retrieved for this review; no competitor price is quoted. Check its current plans and embedding permissions before subscribing.",
    rows: [
      { topic: "Website embedding", portfolia: "Included on Free; copy your portfolio’s embed code.", other: "Paid Issuu plan required, according to Squarespace’s integration guide.", source: 0 },
      { topic: "Publishing a PDF", portfolia: "Preview before signing in; save and publish a portfolio.", other: "Upload a file into Issuu’s Publications area.", source: 0 },
      { topic: "Website display", portfolia: "A portfolio viewer with selectable reading styles.", other: "Publication embed code and a full-screen lightbox are documented.", source: 0 },
    ],
    sources: [{ label: "Squarespace’s Issuu integration guide", url: "https://support.squarespace.com/hc/en-us/articles/206545267-Using-Issuu-with-Squarespace" }, { label: "Issuu plans — check current terms", url: "https://issuu.com/pricing" }],
    question: { q: "Will my old Issuu address redirect to Portfolia?", a: "No. Publish your new portfolio, then update your website embed, CV, QR cards and application links. Keep your original PDF and check every page before removing an old publication." },
  },
  {
    name: "Heyzine", slug: "heyzine-alternative",
    intro: "Choosing between Heyzine and Portfolia for a lookbook or design portfolio? Both let you share PDFs online. The useful distinction is whether you need a broad interactive publication toolkit or a focused presentation of your own creative work.",
    focus: "Heyzine’s free Basic plan includes five flipbooks, 1 GB of storage and password protection. It also advertises multimedia, forms and web embeds. These are meaningful advantages if your publication needs sound, video or an embedded form. Portfolia concentrates on PDF artwork, lighting, scrapbook notes and navigation.",
    choose: "Choose Heyzine when multimedia or downloadable offline publications are central to the brief. Choose Portfolia when you want to present finished projects with a professional profile and compare a clean reader with a lit booklet. Start with your most image-heavy spread and test it on a phone.",
    price: "Heyzine Standard is listed at $59 billed yearly; Professional offers reader statistics. Annual and monthly options differ by plan, so compare the actual checkout total.",
    rows: [
      { topic: "Free allowance", portfolia: "One PDF portfolio up to 10 MB.", other: "Five flipbooks, unlimited pages, 1 GB storage.", source: 0 },
      { topic: "Page additions", portfolia: "Website-link icons, scrapbook notes and repositionable page tabs.", other: "Links, audio, video, forms and web embeds are advertised.", source: 0 },
      { topic: "Offline delivery", portfolia: "Online viewer; optional original PDF download.", other: "Offline flipbook downloads are included in Standard.", source: 0 },
      { topic: "Reporting", portfolia: "Basic visit statistics for account and portfolio views.", other: "Reader statistics are listed on Professional.", source: 0 },
    ],
    sources: [{ label: "Heyzine features and plans", url: "https://heyzine.com/" }],
    question: { q: "Is Heyzine free, or only a trial?", a: "Heyzine lists a free Basic plan. Portfolia also has a Free plan. Compare the different file and publication allowances rather than assuming either free option includes every paid feature." },
  },
  {
    name: "Flipsnack", slug: "flipsnack-alternative",
    intro: "Flipsnack or Portfolia for a creative portfolio? Start with how you make the work. Flipsnack combines publication design with business publishing tools; Portfolia starts with the finished PDF you already designed in your own software.",
    focus: "Flipsnack includes a Design Studio, templates and business publishing workflows. Its Pro plan lists video, lead forms, statistics and Google Analytics, while Business adds custom domains and Zapier. Those tools suit an ongoing campaign or catalogue operation; a job application may need a much smaller workflow.",
    choose: "Choose Flipsnack if several publications feed a marketing process or you want to design inside the publishing platform. Choose Portfolia for a prepared portfolio whose layout should stay yours. Export a representative PDF and compare page readability, phone navigation and the time it takes to share a working link.",
    price: "Flipsnack Lite is listed at $14/month with $168 billed annually. Pro and Business add different capabilities; an annual rate is not a month-to-month checkout price.",
    rows: [
      { topic: "Design workflow", portfolia: "Upload a finished PDF; customise its presentation.", other: "Upload PDFs or design from scratch in Design Studio.", source: 0 },
      { topic: "Lead collection", portfolia: "Profile and website links; no built-in lead forms.", other: "Lead forms and export are listed on Pro.", source: 1 },
      { topic: "Analytics", portfolia: "Basic view statistics, without campaign heatmaps or GA4.", other: "Full statistics and Google Analytics are listed on Pro.", source: 1 },
      { topic: "Integrations", portfolia: "Share a link, QR code or website embed.", other: "Business lists Zapier integration and custom domains.", source: 1 },
    ],
    sources: [{ label: "Flipsnack product features", url: "https://www.flipsnack.com/" }, { label: "Flipsnack current plans", url: "https://www.flipsnack.com/go-premium.html" }],
    question: { q: "Can Portfolia replace Flipsnack’s design editor?", a: "No. Design the pages in your preferred application and upload the PDF to Portfolia. Its editor controls the viewer, lighting, backgrounds, notes, tabs and link icons rather than rebuilding your page layout." },
  },
  {
    name: "FlipHTML5", slug: "fliphtml5-alternative",
    intro: "Looking for a FlipHTML5 alternative for a finished portfolio? Portfolia offers a smaller workflow around your PDF, while FlipHTML5 also provides templates, other file conversions, AI tools and a wider multimedia publishing environment.",
    focus: "FlipHTML5 accepts several document formats and provides templates and AI-assisted creation. Its Free plan lists sharing and embedding; Pro lists link detection and custom branding, and Platinum adds multimedia and custom domains. Compare the flipbook plan separately from its AI subscription options.",
    choose: "Choose FlipHTML5 if you want to build or enrich a publication in a broader content platform. Choose Portfolia if the design is already complete and presentation is the remaining job: a lit booklet for a lookbook, Scroll for long projects or Page by page for individual compositions.",
    price: "FlipHTML5 lists a Free plan and Pro at $149 billed yearly. Its displayed monthly equivalent is rounded; consult the live plan table for billing and regional currency details.",
    rows: [
      { topic: "Input and creation", portfolia: "Finished PDF portfolios.", other: "PDF/PPT/Word/images, templates and AI creation tools.", source: 0 },
      { topic: "Free sharing", portfolia: "Portfolio link, QR code and embedding.", other: "Sharing and embedding are listed on Free.", source: 1 },
      { topic: "PDF link detection", portfolia: "Native PDF links in Scroll/Page by page; added link icons in every mode.", other: "PDF link detection is listed on Pro.", source: 1 },
      { topic: "Custom domains", portfolia: "Permanent Portfolia links; no own-domain hosting.", other: "Custom domains are listed on Platinum.", source: 1 },
    ],
    sources: [{ label: "FlipHTML5 creation and publishing features", url: "https://fliphtml5.com/" }, { label: "FlipHTML5 flipbook plans", url: "https://fliphtml5.com/fliphtml5-pricing.php" }],
    question: { q: "Does Portfolia generate portfolio pages with AI?", a: "No. Your uploaded PDF supplies the artwork and layout. Portfolia lets you choose its viewing style and add presentation elements; it does not generate or rewrite the underlying creative work." },
  },
  {
    name: "Paperturn", slug: "paperturn-alternative",
    intro: "Paperturn and Portfolia both present PDFs online, but the buying decisions differ. Paperturn’s plans target growing publication and business workflows. Portfolia is designed around sharing individual creative portfolios with clients, practices and recruiters.",
    focus: "Paperturn offers a 14-day trial. Its Starter plan lists ten flipbooks and built-in analytics; Growth adds interactivity, website embedding and custom domains. Business includes team permissions, lead capture and bulk linking. These capabilities matter when publications are part of a larger organisational process.",
    choose: "Choose Paperturn when reporting, lead collection or controlled team publishing is a requirement. Choose Portfolia when you need a portfolio link and a considered visual presentation without a business publishing workflow. Check the full annual commitment as well as the specific feature tier you need.",
    price: "Paperturn Starter is listed at $24/month billed yearly at $288, or $39/month. Growth lists website embedding. Portfolia includes embedding on Free.",
    rows: [
      { topic: "Getting started", portfolia: "Free plan: one PDF up to 10 MB.", other: "14-day free trial; paid publication plans.", source: 0 },
      { topic: "Website embed", portfolia: "Included on Free.", other: "Website embedding is listed under Growth.", source: 1 },
      { topic: "Team workflow", portfolia: "Individual portfolio/account editing; no team permission system.", other: "Business lists roles, permissions and activity logs.", source: 1 },
      { topic: "Lead collection", portfolia: "Link visitors to your contact page or store.", other: "Business lists lead forms and request-for-quote carts.", source: 1 },
    ],
    sources: [{ label: "Paperturn product and trial", url: "https://www.paperturn.com/" }, { label: "Paperturn current plans", url: "https://www.paperturn.com/prices" }],
    question: { q: "Is Portfolia a team publishing platform?", a: "No. Portfolia’s current workflow is for an individual creator’s portfolios and profile. If you need editor roles, approval workflows or central brand governance, compare dedicated team publishing products." },
  },
  {
    name: "Publuu", slug: "publuu-alternative",
    intro: "Compare Publuu and Portfolia when your PDF is ready to share. Publuu offers interactive publication and marketing tools. Portfolia focuses on the way creative work is seen: clean reading styles, optional Studio lighting and a personal portfolio profile.",
    focus: "Publuu advertises multimedia hotspots, reader analytics, lead generation and virtual bookshelves. It also offers a branded Android app with offline access. For a catalogue library or recurring publication, those can be valuable; for one portfolio, test whether you actually need that distribution system.",
    choose: "Choose Publuu when a publication needs richer media, a branded library or reader engagement tools. Choose Portfolia when the PDF is the finished creative artefact and you want to share it directly. Try your busiest spread, portrait pages and small captions in both viewers before deciding.",
    price: "Publuu offers trial access and several paid plans. Consult its current pricing page for the publication allowance and feature tier; this page does not assume trial access is a permanent free plan.",
    rows: [
      { topic: "Interactive content", portfolia: "Website-link icons, scrapbook notes and page tabs.", other: "Videos, links, hotspots, galleries and audio are advertised.", source: 0 },
      { topic: "Engagement reporting", portfolia: "Basic view statistics.", other: "Views, time on pages and interactions are advertised.", source: 0 },
      { topic: "Collection display", portfolia: "Creator profile with published portfolios.", other: "Virtual bookshelf for a branded publication library.", source: 0 },
      { topic: "Reader app", portfolia: "Browser-based viewer; no branded mobile app.", other: "Branded Android app with offline access is advertised.", source: 0 },
    ],
    sources: [{ label: "Publuu features", url: "https://publuu.com/" }, { label: "Publuu current plans", url: "https://publuu.com/prices/" }],
    question: { q: "Do readers need an app to open Portfolia?", a: "No. A portfolio opens in the browser from its link or QR code. Portfolia does not currently provide a downloadable offline flipbook or a branded mobile application." },
  },
  {
    name: "FlipBooklets", slug: "flipbooklets-alternative",
    intro: "FlipBooklets and Portfolia both suit an already designed PDF. Compare the navigation and presentation you need: FlipBooklets advertises search and reader bookmarks, while Portfolia offers named projects, page tabs and Simple or Studio viewing.",
    focus: "FlipBooklets advertises an ad-free free plan, automatic PDF hyperlinks, bookmarks, searchable live text and analytics by device and location. Its feature list also includes custom domains. Search and bookmarking may matter more than lighting when a reader needs to repeatedly locate information in a long document.",
    choose: "Choose FlipBooklets when text search, reader bookmarks or a custom domain is essential. Choose Portfolia when visual sequencing and project presentation carry the story. Test an actual PDF with small typography, large images and contact links rather than comparing only a platform’s sample publication.",
    price: "FlipBooklets lists a free forever plan. Its features page does not establish every free-versus-paid entitlement; check the current account plans for custom-domain and advanced-feature access.",
    rows: [
      { topic: "Text navigation", portfolia: "Named projects and creator-positioned page tabs; no full-document text search.", other: "Searchable live text and reader bookmarks are advertised.", source: 0 },
      { topic: "Hyperlinks", portfolia: "Native PDF links in Scroll/Page by page; added icons in every mode.", other: "Automatic hyperlinks from the uploaded PDF are advertised.", source: 0 },
      { topic: "Analytics", portfolia: "Basic account and portfolio view statistics.", other: "Views, location and device analytics are advertised.", source: 0 },
      { topic: "Domain", portfolia: "Permanent Portfolia sharing links.", other: "Custom domains via CNAME are advertised; check plan access.", source: 0 },
    ],
    sources: [{ label: "FlipBooklets features", url: "https://flipbooklets.com/features" }, { label: "FlipBooklets free plan", url: "https://flipbooklets.com/" }],
    question: { q: "Does Portfolia include search and reader bookmarks?", a: "Not currently. Creators can give projects names and add page tabs to guide readers. If readers must search a long text document or save their own bookmarks, compare those requirements separately." },
  },
  {
    name: "PDFDeck / Linkjar", slug: "pdfdeck-alternative",
    intro: "Searching for a PDFDeck alternative? PDFDeck’s homepage now redirects to Linkjar, whose footer identifies it as formerly PDF Deck. Compare its current document-sharing plans with Portfolia’s PDF portfolio presentation, rather than relying on old feature lists.",
    focus: "Linkjar’s Free plan lists three documents up to 10 MB each, open alerts, per-person links, flipbooks and embeds. Starter adds custom domains, passwords and expiry dates. Pro adds page-by-page time, scroll depth and an email gate. Its tracking workflow is broader than Portfolia’s basic view counts.",
    choose: "Choose Linkjar when identifying recipients or tracking how they read a document is central to the job. Choose Portfolia when your audience needs to browse creative work in a presentation you control. Portfolia does not offer custom domains, and a visit count does not identify a reader.",
    price: "Linkjar lists Free, Starter at $6/month and Pro at $24 per user/month on monthly billing. Its page also offers annual billing; check the selected cycle and taxes.",
    rows: [
      { topic: "Free files", portfolia: "One PDF portfolio up to 10 MB.", other: "Three documents up to 10 MB each.", source: 1 },
      { topic: "Reader identification", portfolia: "Basic visit totals; no per-recipient tracking links or open alerts.", other: "Free lists per-person links and open alerts.", source: 1 },
      { topic: "Detailed tracking", portfolia: "No page-by-page reading time or email gate.", other: "Pro lists page time, scroll depth and an email gate.", source: 1 },
      { topic: "Privacy controls", portfolia: "Personal supports passwords and expiring links.", other: "Starter lists passwords, expiry and custom domains.", source: 1 },
    ],
    sources: [{ label: "PDFDeck’s current destination", url: "https://pdfdeck.com/" }, { label: "Linkjar current plans", url: "https://linkjar.com/pricing/" }],
    question: { q: "Is PDFDeck still the name of the product?", a: "At this review date its homepage redirects to Linkjar, and Linkjar’s footer says formerly PDF Deck. Check current Linkjar features and pricing when comparing it with Portfolia." },
  },
];

export function comparisonContent(c: Competitor): SeoContent {
  return {
    path: `/${c.slug}`, title: `${c.name} Alternative for PDF Portfolios — Comparison | Portfolia`,
    description: `Compare Portfolia with ${c.name} for PDF portfolios: viewing styles, sharing, editing and plan differences. See where each fits before uploading your work.`,
    h1: `A ${c.name} alternative`, h1Accent: "for your creative portfolio.", intro: c.intro,
    points: [
      { title: "Keep your original layout", body: "Upload the finished PDF you designed. The portfolio editor changes its presentation, with separate settings for each portfolio." },
      { title: "Choose the reading experience", body: "Offer Simple or Studio lighting alongside Flipbook, Scroll or Page by page. Add website icons, scrapbook notes and tabs." },
      { title: "Start with a real PDF", body: `Free includes one portfolio up to 10 MB, QR codes and embedding. Personal is ${PRICE.month}/month or ${PRICE.year}/year, with up to ten portfolios and 50 MB per PDF.` },
    ],
    steps: ["Export your original portfolio as a PDF.", "Upload it, test each page and choose your viewer settings.", "Publish, then replace the links and embeds you want to move."],
    faqs: [c.question, { q: `Can I import my existing ${c.name} web address?`, a: "No. Upload your original PDF to create a new Portfolia link. Third-party addresses, viewer settings, interactive overlays and analytics are not automatically imported." }],
  };
}
