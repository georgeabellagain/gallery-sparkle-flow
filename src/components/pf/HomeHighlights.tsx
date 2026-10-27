import { ArrowRight, BarChart3, Check, Info, Lock, MousePointerClick, Palette, QrCode, Search, X, Youtube, Inbox } from "lucide-react";
import { InfoTip } from "./InfoTip";

/** Plain facts about the product under the hero, the way flipbook makers reassure first-time visitors. */
export function FactStrip() {
  const facts = ["About a minute from PDF to link", "Free forever for one portfolio", "Works on every phone and tablet", "No app or sign-up for readers"];
  return (
    <div className="rule-t bg-canvas">
      <ul className="shell flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 text-xs text-muted-foreground sm:text-sm">
        {facts.map((f, i) => <li key={f} className="flex items-center gap-2">{i > 0 && <span aria-hidden className="hidden size-1 rounded-full bg-border-strong sm:block" />}{f}</li>)}
      </ul>
    </div>
  );
}

const COMPARE: Array<[string, boolean, boolean]> = [
  ["Opens instantly in any browser, nothing to download", false, true],
  ["Turns like a real book, on phones too", false, true],
  ["Links, buttons, videos and pop-ups on the pages", false, true],
  ["Update it any time; the link you sent stays the same", false, true],
  ["See who read it, which pages, and for how long", false, true],
  ["Password, expiry date and your own address", false, true],
];

/** Why a link beats an attachment: the comparison flipbook sites lead with, made for creative work. */
export function PdfVersusLink() {
  return (
    <section aria-labelledby="pdf-vs-title" className="rule-t">
      <div className="shell grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="label-xs">PDF or Portfolia</p>
          <h2 id="pdf-vs-title" className="display-title mt-2 text-3xl sm:text-5xl">Why send a link instead of a PDF?</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">A PDF attachment is static, heavy and gone once you send it. A Portfolia link is your work as a living book: easy to open, easy to share, and you can see what happens next.</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center border-b border-border px-5 py-3 text-xs font-medium text-muted-foreground">
            <span>What readers get</span><span className="text-center">PDF file</span><span className="text-center text-foreground">Portfolia</span>
          </div>
          <ul className="divide-y divide-border">
            {COMPARE.map(([label, pdf, us]) => (
              <li key={label} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center px-5 py-3 text-sm">
                <span>{label}</span>
                <span className="flex justify-center">{pdf ? <Check className="size-4 text-leaf" aria-label="Yes" /> : <X className="size-4 text-muted-foreground/60" aria-label="No" />}</span>
                <span className="flex justify-center">{us ? <Check className="size-4 text-leaf" aria-label="Yes" /> : <X className="size-4 text-muted-foreground/60" aria-label="No" />}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: MousePointerClick, title: "Hotspots and buttons", text: "Product tags, pop-up cards with a picture and price, and buttons to your shop, email or phone.", tip: "Place them anywhere on a page in the Scrapbook editor. Each one opens a pop-up or goes straight to a link." },
  { icon: Youtube, title: "YouTube and Vimeo", text: "Paste a link and the video plays right on the page, or starts by itself, muted.", tip: "Nothing loads from the video site until a reader presses play, so pages stay quick and private." },
  { icon: Info, title: "Info icons", text: "A small (i) that shows extra words when readers hover, or tap on a phone.", tip: "Good for materials, credits, sizes and anything that would crowd the page." },
  { icon: Inbox, title: "Lead forms", text: "Ask readers for their email (and more) at a page you choose, and get each reply by email.", tip: "Part of Personal. Replies are kept in your account and download as a spreadsheet." },
  { icon: BarChart3, title: "Reader insights", text: "Which pages people read and for how long, what they click and play, and how far they get.", tip: "Part of Personal: devices, countries and the sites readers came from, with a CSV export for reports." },
  { icon: Palette, title: "Your brand", text: "Your logo in the viewer, your colours, lighting, backgrounds and your own address.", tip: "Personal removes the Portfolia credit and gives you portfolia.site/yourname." },
  { icon: Lock, title: "Privacy controls", text: "Password protection, an expiry date, hidden pages and downloads on or off.", tip: "Password and expiry are part of Personal. Hiding pages and switching downloads off are free." },
  { icon: QrCode, title: "Share anywhere", text: "A permanent link, a QR code, an embed for your website, and links to any page.", tip: "Replace your PDF whenever you like; every link and QR code you have shared keeps working." },
  { icon: Search, title: "Easy to read", text: "Search, page thumbnails, contents, zoom and full screen, in flipbook, scroll or page by page.", tip: "Readers choose how to read; you choose which reading styles and buttons they get." },
] as const;

/** Everything in one place, each with an (i) for the detail, as feature-led flipbook sites present it. */
export function FeatureGrid() {
  return (
    <section aria-labelledby="features-title" className="rule-t">
      <div className="shell py-14 sm:py-20">
        <p className="label-xs">Features</p>
        <h2 id="features-title" className="display-title mt-2 max-w-2xl text-3xl sm:text-5xl">Everything your PDF can't do on its own.</h2>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, tip }) => (
            <li key={title} className="bg-background p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-leaf-soft text-leaf"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-4 flex items-center gap-1 text-base font-medium">{title}<InfoTip label={`More about ${title}`}>{tip}</InfoTip></h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const USES = [
  { title: "Portfolios", text: "Architecture, design, photography, illustration and art portfolios that open like a book.", href: "/graphic-design-portfolio" },
  { title: "Lookbooks and catalogues", text: "Seasonal lookbooks and product catalogues with shop buttons and product pop-ups.", href: "/lookbook-maker" },
  { title: "Books and zines", text: "Preview chapters, zines and photo books, with a buy button and studio-quality book photos.", href: "/book-marketing" },
  { title: "Brochures and reports", text: "Brochures, magazines and reports you can update without re-sending, and see who read.", href: "/magazine-flipbook" },
] as const;

/** Who it's for, one card per kind of publication, each leading to its own guide. */
export function UseCases() {
  return (
    <section aria-labelledby="uses-title" className="rule-t bg-canvas">
      <div className="shell py-14 sm:py-16">
        <p className="label-xs">Made for</p>
        <h2 id="uses-title" className="display-title mt-2 text-3xl sm:text-4xl">Whatever you publish as a PDF.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map((u) => (
            <a key={u.title} href={u.href} className="group flex flex-col rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-soft">
              <span className="text-base font-medium">{u.title}</span>
              <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{u.text}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-xs text-leaf">See how <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
