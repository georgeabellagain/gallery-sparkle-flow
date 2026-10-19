import type { SeoContent } from "@/components/pf/SeoLanding";

/**
 * Landing pages for what people search to do with a PDF (link it, share it, host it, QR it, send it), as found in
 * Google autocomplete and Trends (October 2026). Copy must stay true to the product: every claim here is a shipped
 * feature or a clearly labelled outside fact.
 */
type Page = Omit<SeoContent, "path"> & { label: string };

const freeFaq = { q: "Is it free?", a: "Yes. The Free plan hosts one PDF up to 10 MB with a permanent link and QR code. Personal adds up to 10 PDFs of 50 MB each." };
const previewFaq = { q: "Do I need an account?", a: "Not to try it. Drop your PDF on the homepage to preview it straight away. Sign in, free, when you want to publish your link." };
const replaceFaq = { q: "What if I change the PDF later?", a: "Replace the file whenever you like. Your link and QR code stay the same, so anything you have already sent opens the new version." };
const privateFaq = { q: "Can I keep it private?", a: "Unpublished PDFs are never public. With Personal you can add a password and an expiry date to a published link." };

export const TASK_PAGES: Record<string, Page> = {
  "pdf-to-link": {
    label: "PDF to link",
    title: "PDF to Link — Turn a PDF Into a Shareable Link Free | Portfolia",
    description: "Turn your PDF into a link anyone can open on any device. Preview without signing up, then share one permanent link or QR code. Free for one PDF up to 10 MB.",
    h1: "Turn your PDF into a link", h1Accent: "anyone can open.",
    intro: "Drop in a PDF and get a clean web link that opens in any browser, on phones and laptops, with nothing to download. Built for portfolios, books, lookbooks and catalogues, and it works for any PDF you want people to read.",
    points: [
      { title: "No sign-up to try", body: "Preview your PDF as a link-ready page straight away. A free account is only needed to publish." },
      { title: "A link that lasts", body: "Your link never changes, even when you replace the PDF, so emails, CVs and printed QR codes keep working." },
      { title: "Read beautifully", body: "Visitors read as a 3D flipbook, page by page or as a scroll, and zoom into detail. You choose which styles they can use." },
    ],
    sections: [
      { title: "What kind of link do I get?", body: "Every published PDF gets a permanent address such as portfolia.site/p/abc12, plus a downloadable QR code. With Personal you can also claim a short personal address like portfolia.site/yourname. The link opens a fast viewer, not a file download, unless you allow downloading." },
      { title: "When a link beats an attachment", body: "Attachments get blocked, stripped or buried in downloads folders, and the recipient needs the right app. A link opens instantly, always shows your latest version and can be pasted into job applications, social bios and messages." },
    ],
    checklist: ["Export the PDF from your design app with web-friendly image sizes.", "Keep it under 10 MB on Free (the upload box can repack larger files losslessly on your device).", "Decide whether visitors may download the original file.", "Open the link on your phone before sending it."],
    steps: ["Drop your PDF on the homepage to preview it.", "Sign in free and publish.", "Copy your link or download its QR code."],
    faqs: [previewFaq, freeFaq, replaceFaq, { q: "Can people download my PDF from the link?", a: "Only if you switch downloading on. Otherwise the link shows the pages in the viewer." }, privateFaq],
  },
  "share-pdf-online": {
    label: "Share a PDF online",
    title: "Share a PDF Online Free — One Link, Any Device | Portfolia",
    description: "Share a PDF online without attachments: one link that opens on any device, plus a QR code, a website embed and one-tap sharing to LinkedIn, WhatsApp and email.",
    h1: "Share your PDF online", h1Accent: "without the attachment.",
    intro: "Send a link instead of a file. Your PDF opens in the browser on any device, looks the way you designed it and always shows the latest version.",
    points: [
      { title: "Share anywhere", body: "Copy the link, download a QR code, or share to LinkedIn, Facebook, X, WhatsApp, Pinterest or email from the Share panel." },
      { title: "Put it on your website", body: "Embed the viewer on Squarespace, Wix, Notion or any site that accepts an embed code." },
      { title: "See it was opened", body: "Basic visit statistics show how many people viewed your PDF and clicked download." },
    ],
    sections: [
      { title: "Sharing a PDF on social media", body: "LinkedIn, Instagram and other networks don't display PDFs well as attachments. Sharing your Portfolia link shows a preview card with your cover, and the PDF opens full screen when tapped. Personal adds a flip-through video of your PDF for posts and stories." },
      { title: "Sharing with a client or employer", body: "Paste the link into the body of your email with a short note. It keeps messages small, avoids spam filters that dislike large attachments, and lets you fix a typo after sending by replacing the file." },
    ],
    checklist: ["Write a one-line description to go with the link.", "Check the preview card by pasting the link into a message to yourself.", "Allow or block downloading.", "Add a password with Personal for confidential work."],
    steps: ["Upload your PDF.", "Publish it with a free account.", "Open Share to copy the link, get the QR code or post to a network."],
    faqs: [freeFaq, previewFaq, { q: "Can I share a PDF on Instagram?", a: "Instagram doesn't accept PDFs. Put your Portfolia link in your bio or a story link, or post the flip-through video included with Personal." }, replaceFaq, privateFaq],
  },
  "pdf-to-website": {
    label: "PDF to website",
    title: "PDF to Website — Make a One-Page Site From Your PDF | Portfolia",
    description: "Turn a PDF into a simple website in minutes: your pages in a flipbook or scroll viewer with your profile and contact links. No website builder needed.",
    h1: "Turn your PDF", h1Accent: "into a website.",
    intro: "Already designed it as a PDF? Don't rebuild it in a website builder. Portfolia turns the PDF into a single page with a polished viewer, your profile and contact links, ready to share.",
    points: [
      { title: "No templates to fight", body: "Your layout stays exactly as you designed it in InDesign, Illustrator, Canva or Figma." },
      { title: "A profile around it", body: "Add your name, role, a short introduction, photo and links to email, LinkedIn or your shop." },
      { title: "Your own address", body: "Share portfolia.site/p/… free, or a personal portfolia.site/yourname with Personal." },
    ],
    sections: [
      { title: "Is it a full website?", body: "It's a single, focused page for one document or portfolio, not a multi-page site builder. If you already have a website, embed the Portfolia viewer on it instead of uploading a large file. Personal hosts up to 10 PDFs, each with its own page." },
      { title: "Search engines", body: "You choose, per PDF, whether search engines may index its page. Leave it off for private applications, or switch it on for work you want people to find." },
    ],
    checklist: ["Write a short introduction for the top of the page.", "Add your contact links.", "Pick the reading styles visitors can use.", "Decide whether search engines may index it."],
    steps: ["Upload your PDF.", "Add your profile and contact links.", "Publish and share your page."],
    faqs: [freeFaq, { q: "Can I use my own domain?", a: "Not at the moment. You can use a personal portfolia.site address with Personal, or embed the viewer on a website you already own." }, replaceFaq, previewFaq],
  },
  "host-pdf": {
    label: "Host a PDF",
    title: "Host a PDF Online Free — Permanent Link & Viewer | Portfolia",
    description: "Host your PDF online free with a permanent link, a fast flipbook or scroll viewer and optional downloads. Replace the file without breaking the link.",
    h1: "Host your PDF online,", h1Accent: "free and permanently.",
    intro: "Need somewhere reliable to put a PDF so people can read it? Portfolia stores it privately and serves it through a viewer on a link that doesn't change.",
    points: [
      { title: "Free hosting", body: "One PDF up to 10 MB on Free; up to 10 PDFs of 50 MB each on Personal." },
      { title: "Read or download", body: "Visitors read in the browser. Turn on downloading if you want them to save the original file." },
      { title: "Swap files safely", body: "Replace the PDF and keep the same link; visit statistics carry on." },
    ],
    sections: [
      { title: "Hosting a PDF for your website", body: "Many website builders link PDFs as plain downloads. Embed the Portfolia viewer instead so visitors read on the page; see the Squarespace, Wix and Notion embedding guides. Cancelling Personal never deletes your files." },
      { title: "How files are stored", body: "Files are kept in private storage tied to your account and served through short-lived signed links. Drafts are never public." },
    ],
    checklist: ["Check the file size before uploading.", "Name the PDF clearly; it shows as the title.", "Choose whether downloads are allowed.", "Embed it on your site if you have one."],
    steps: ["Upload your PDF.", "Publish with a free account.", "Share the link or embed it on your website."],
    faqs: [freeFaq, { q: "Can I host a PDF for download?", a: "Yes. Switch on downloading and visitors get a download button alongside the viewer." }, { q: "Can I host a PDF on Squarespace?", a: "Yes. Embed your Portfolia viewer on any Squarespace page with the embed code from the Share panel. Our Squarespace guide shows each step." }, replaceFaq],
  },
  "pdf-qr-code": {
    label: "PDF QR code",
    title: "PDF QR Code Generator — Free QR for Your PDF | Portfolia",
    description: "Create a QR code that opens your PDF. High-resolution PNG, made on your device, linked to a permanent address so you can update the PDF without reprinting.",
    h1: "A QR code for your PDF,", h1Accent: "that never needs reprinting.",
    intro: "Upload your PDF and download a high-resolution QR code that opens it in any phone's camera. Because the code points to a permanent link, you can update the PDF later and every printed code still works.",
    points: [
      { title: "Print-ready PNG", body: "Download a crisp, high-resolution QR code for CVs, business cards, posters and stands." },
      { title: "Update without reprinting", body: "Replace the PDF and the same code opens the new version." },
      { title: "Private by design", body: "The code is generated in your browser; no third-party QR service receives your link." },
    ],
    sections: [
      { title: "Where people use a PDF QR code", body: "On a CV or résumé so recruiters can open a portfolio, on degree-show labels, exhibition walls and fair stands, on menus and price lists, and on the back of printed books and lookbooks." },
      { title: "Make it easy to scan", body: "Print it at least 2–3 cm wide, keep a quiet margin around it, and test it with a couple of phones before a print run." },
    ],
    checklist: ["Publish the PDF first; the code opens the published link.", "Print the code large enough to scan.", "Add a short call to action next to it.", "Test the printed proof with your phone."],
    steps: ["Upload and publish your PDF.", "Open Share and choose QR code.", "Download the PNG and add it to your design."],
    faqs: [freeFaq, replaceFaq, { q: "Does the QR code expire?", a: "No. It points to your permanent link. If you add an expiry date with Personal, the link (and so the code) stops opening after that date." }, previewFaq],
  },
  "ucas-portfolio": {
    label: "UCAS & university portfolio",
    title: "UCAS Portfolio — Share Your University Portfolio as a Link | Portfolia",
    description: "Applying for art, design or architecture? Share your university portfolio as one link that opens on any device. Free to start, easy to update.",
    h1: "Your university portfolio,", h1Accent: "ready to send.",
    intro: "Most UK art, design and architecture courses ask for a portfolio after you apply through UCAS, as a PDF upload, a link or through their own portal. Portfolia gives your portfolio PDF a clean link that admissions tutors can open on any device.",
    points: [
      { title: "Opens anywhere", body: "Tutors can read it on a laptop, tablet or phone, with zoom for detail." },
      { title: "One link, many courses", body: "Keep one link up to date, or use Personal for a separate version per university." },
      { title: "Show it at interview", body: "Present full screen as a book or page by page, and bring the QR code on printed work." },
    ],
    sections: [
      { title: "Follow each university's instructions", body: "Requirements differ: some ask for a PDF of a set length or file size, some want an upload to their own portal and some accept a link. Always use the format they ask for. If they want a file, upload your PDF itself; Portfolia is ideal when a link is accepted, or for sharing with teachers and at interview." },
      { title: "What makes a strong portfolio", body: "Lead with your strongest project, show process as well as finished pieces, label each project briefly and keep the order easy to follow. Ask your teachers to review it on a phone as well as a laptop." },
    ],
    checklist: ["Check each course's page count and file-size limits.", "Put your name and course on the first page.", "Show sketchbook and process pages, not only final work.", "Test the link on a phone before submitting."],
    steps: ["Export your portfolio as a PDF.", "Upload it, add your name and the course.", "Paste the link where the university accepts one."],
    faqs: [{ q: "Does UCAS take portfolios?", a: "Not directly. Universities ask for portfolios themselves after you apply, each with its own format and deadline." }, freeFaq, replaceFaq, { q: "Can I make it private?", a: "Unpublished portfolios are never public. Personal adds a password and an expiry date, useful once applications close." }],
  },
  "how-to-send-a-portfolio": {
    label: "How to send a portfolio",
    title: "How to Send a Portfolio by Email or Link — A Simple Guide | Portfolia",
    description: "How to send your portfolio to employers, clients and universities: link or PDF, what to write in the email, file sizes and adding the link to your CV.",
    h1: "How to send a portfolio", h1Accent: "that actually gets opened.",
    intro: "A great portfolio is wasted if it bounces, won't open on a phone or gets lost in an attachment. Here's how to send it well, and how a portfolio link helps.",
    points: [
      { title: "Prefer a link", body: "A link keeps emails small, opens on any device and always shows your latest version." },
      { title: "Add it to your CV", body: "Put the link (or a QR code) in your CV header and LinkedIn Featured section." },
      { title: "Know it landed", body: "Basic visit statistics show whether your portfolio was opened." },
    ],
    sections: [
      { title: "What to write in the email", body: "Use a clear subject such as \"Portfolio – Junior Designer application – Your Name\". In two or three sentences say who you are, what you're applying for and which project to look at first, then paste the link. Mention a PDF is available on request if they prefer a file." },
      { title: "Link or PDF?", body: "Send exactly what is requested. When there's no instruction, a link is safer: attachments over about 20–25 MB are rejected by many email services, and a link can be updated after sending. If a PDF is required, keep it compact and name it clearly, for example YourName-Portfolio-2026.pdf." },
    ],
    checklist: ["Follow the recipient's format if they give one.", "Name files and links with your name.", "Lead with the work most relevant to them.", "Send a test to yourself and open it on your phone."],
    steps: ["Upload your portfolio PDF.", "Publish it and copy the link.", "Paste the link into your email, CV and LinkedIn."],
    faqs: [{ q: "Should I attach my portfolio or send a link?", a: "Whatever the recipient asks for. Otherwise a link is easier to open and update." }, { q: "How do I add a portfolio link to my CV?", a: "Add it next to your contact details, ideally as a short personal address (portfolia.site/yourname with Personal), plus a QR code on printed copies." }, freeFaq, previewFaq],
  },
  "send-large-pdf": {
    label: "PDF too large to email",
    title: "PDF Too Large to Email? Send It as a Link Instead | Portfolia",
    description: "PDF too big to attach? Gmail allows 25 MB and Outlook 20 MB. Send it as a link instead: up to 50 MB with Personal, plus lossless optimisation.",
    h1: "PDF too large to email?", h1Accent: "Send a link instead.",
    intro: "Email services cap attachments: Gmail at 25 MB and Outlook at 20 MB, and many company inboxes lower. Instead of crushing your images, upload the PDF and send a link that opens instantly.",
    points: [
      { title: "Bigger than email allows", body: "Host PDFs up to 10 MB free, or up to 50 MB each with Personal." },
      { title: "Lossless optimisation", body: "The upload box can repack an oversized PDF on your device without downsampling images, which often makes it smaller." },
      { title: "Full quality to read", body: "Recipients zoom into sharp pages in the viewer instead of opening a compressed copy." },
    ],
    sections: [
      { title: "Why not just compress it?", body: "Online compressors usually shrink PDFs by lowering image quality, the opposite of what a portfolio or lookbook needs. Portfolia's optimisation only repacks the file's structure, and when that isn't enough, a hosted link removes the size problem altogether." },
      { title: "If it's still too big", body: "Export a web copy from your design app with images at screen resolution (around 150–200 ppi), or split very long documents. Your print-quality file can stay on your computer." },
    ],
    checklist: ["Check the file size before sending.", "Try Large PDF? Upload options in the upload box.", "Export a web copy if it's above 50 MB.", "Send the link in the email body."],
    steps: ["Drop your PDF in the upload box (use Large PDF? options if it's over the limit).", "Publish it with a free account.", "Email the link instead of the attachment."],
    faqs: [{ q: "What is the attachment limit for Gmail and Outlook?", a: "Gmail allows attachments up to 25 MB and Outlook.com up to 20 MB in total per message. Work email systems are often stricter." }, { q: "Does optimisation reduce quality?", a: "No. It repacks the PDF's internal structure without rasterising pages or downsampling images. If it can't make the file smaller, the original is kept." }, freeFaq, replaceFaq],
  },
  "lookbook-maker": {
    label: "Lookbook maker",
    title: "Lookbook Maker — Turn Your Lookbook PDF Into a Flipbook | Portfolia",
    description: "Present your fashion or brand lookbook as a lit 3D flipbook with shoppable link icons, a QR code for shows and an embed for your store. Free to start.",
    h1: "A lookbook that turns", h1Accent: "like the printed one.",
    intro: "Design your lookbook in InDesign, Canva or Illustrator, export a PDF and upload it. Portfolia presents it as an editorial flipbook under studio light, with clickable icons that take readers straight to each piece.",
    points: [
      { title: "Shoppable pages", body: "Place link icons on any page to send readers to products, stockists or your socials. They work in every reading style." },
      { title: "Editorial presentation", body: "Choose Simple or a 3D Studio book with paper finish, lighting and backdrop that suit the collection." },
      { title: "Shows, press and stores", body: "Share one link with buyers and press, print the QR code at shows and embed the lookbook on your site." },
    ],
    sections: [
      { title: "Templates or your own design?", body: "Portfolia doesn't design the lookbook for you; it presents the PDF you made. Use your own layout or a template from your design app, export single pages or two-page spreads, and keep the cover as the first page." },
      { title: "Photos and videos for marketing", body: "Personal adds a flip-through video for social posts and the Photo shoot for studio-style product photos of your lookbook as a printed book." },
    ],
    checklist: ["Export at screen resolution to keep the file light.", "Add link icons to hero products.", "Choose a backdrop that suits the collection.", "Test the link on a phone, where most buyers will open it."],
    steps: ["Upload your lookbook PDF.", "Add link icons, choose the look and publish.", "Share with buyers, print the QR code or embed it."],
    faqs: [freeFaq, { q: "Can readers click through to products?", a: "Yes. Website link icons can be placed on any page and open the product or stockist page you choose." }, { q: "Do you provide lookbook templates?", a: "No. Design in the app you prefer, then upload the PDF. Spreads and single pages both work." }, replaceFaq],
  },
  "canva-flipbook": {
    label: "Canva to flipbook",
    title: "Canva to Flipbook — Turn Your Canva PDF Into a 3D Flipbook | Portfolia",
    description: "Designed it in Canva? Download it as a PDF and turn it into a page-turning 3D flipbook with a shareable link, QR code and website embed. Free to start.",
    h1: "From Canva", h1Accent: "to a flipbook in minutes.",
    intro: "Download your Canva portfolio, magazine, catalogue or lookbook as a PDF, upload it, and share it as a turning flipbook with a permanent link.",
    points: [
      { title: "Keeps your Canva design", body: "Pages appear exactly as exported. Spreads and single pages both work." },
      { title: "A real page turn", body: "Curved, lit pages that readers drag or click to turn, on desktop and phones." },
      { title: "Links still work", body: "Links in your PDF stay clickable in the scroll and page-by-page views, and you can add link icons to any page for the flipbook." },
    ],
    sections: [
      { title: "How to export from Canva", body: "In Canva choose Share, then Download, and pick PDF Standard for a lighter file or PDF Print for the highest quality. If the PDF is over 10 MB, try PDF Standard or use Large PDF? Upload options when uploading." },
      { title: "When to use Portfolia instead of a Canva link", body: "Use Portfolia when you want readers to experience your design as a book: a page-turning viewer, a permanent link that survives edits, a QR code, visit statistics and an embed for your website." },
    ],
    checklist: ["Download as PDF Standard first; switch to PDF Print if detail suffers.", "Keep the cover as the first page.", "Check the page order before exporting.", "Preview on a phone after uploading."],
    steps: ["In Canva, choose Share, then Download, then PDF.", "Drop the PDF on Portfolia's homepage.", "Publish and share your flipbook link."],
    faqs: [freeFaq, previewFaq, { q: "Does the flipbook keep my Canva links?", a: "Yes in scroll and page-by-page views, which keep PDF links clickable. In the flipbook, add link icons where you want readers to click." }, replaceFaq],
  },
};

export function taskContent(slug: string): SeoContent {
  const { label: _l, ...rest } = TASK_PAGES[slug]!;
  return { path: `/${slug}`, ...rest };
}
