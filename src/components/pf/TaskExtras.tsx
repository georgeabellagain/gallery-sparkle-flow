import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, FileText, Link2, Mail, Paperclip, QrCode, X } from "lucide-react";
import { BookAnimation } from "./BookAnimation";
import { IndustryUpload } from "./IndustryUpload";

/**
 * Page-specific sections for the highest-intent task pages (UCAS, Canva, sending a portfolio, PDF to link).
 * Everything here is client-side and decorative or local: nothing a visitor types leaves their browser.
 */

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- Hero artwork ---------- */

function ArtFrame({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="relative mx-auto w-full max-w-xs sm:max-w-md" aria-hidden>
      <div className="relative flex aspect-square items-center sm:aspect-[5/4] justify-center overflow-hidden rounded-[2rem] border border-border bg-[#e9e8df] shadow-soft">{children}</div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export function PdfToLinkArt() {
  return (
    <ArtFrame caption="One file in, one link out. Your QR code comes free.">
      <div className="pf-link-art">
        <div className="pf-link-file"><FileText className="size-7 text-leaf" /><span><b>portfolio.pdf</b><small>14 pages · 8.4 MB</small></span></div>
        <div className="pf-link-pill"><Link2 className="size-4" /><span>portfolia.site/p/abc12</span><span className="pf-link-copied"><Check className="size-3" /> Copied</span></div>
        <div className="pf-link-qr"><QrCode className="size-10" /></div>
      </div>
    </ArtFrame>
  );
}

export function SendPortfolioArt() {
  return (
    <ArtFrame caption="Swap the bounced attachment for a link that always opens.">
      <div className="pf-mail-art">
        <div className="pf-mail-row"><span>To</span>hiring@studio.co</div>
        <div className="pf-mail-row"><span>Subject</span>Portfolio: Junior Designer</div>
        <div className="pf-mail-body"><i /><i /><i className="w-1/2" /></div>
        <div className="pf-mail-attach"><Paperclip className="size-3.5" />portfolio.pdf · 32 MB<b className="pf-mail-warn"><X className="size-3" /> Too large</b></div>
        <div className="pf-mail-link"><Link2 className="size-3.5" />portfolia.site/jamie</div>
        <div className="pf-mail-sent"><Check className="size-3.5" /> Sent</div>
      </div>
    </ArtFrame>
  );
}

export function CanvaArt() {
  return (
    <ArtFrame caption="Share → Download → PDF → a book people can turn.">
      <div className="flex w-full flex-col items-center gap-5 px-4">
        <ol className="pf-steps-art">
          {["Share", "Download", "PDF Print", "Drop here"].map((s, i) => <li key={s} style={{ animationDelay: `${i * 2}s` }}><span>{i + 1}</span>{s}</li>)}
        </ol>
        <div className="pf-art-book"><BookAnimation cover="CANVA / 01" opening="MY DESIGN" kicker="PAGE" /></div>
      </div>
    </ArtFrame>
  );
}

export function UcasArt() {
  return (
    <ArtFrame caption="Your portfolio as a book tutors can open anywhere.">
      <div className="pf-art-book pf-art-book-lg"><BookAnimation cover="UCAS / ART" opening="SELECTED WORK" kicker="PROJECT" /></div>
    </ArtFrame>
  );
}

/* ---------- Example gallery ---------- */

const EXAMPLES = [
  { key: "architecture", title: "A place to pause", kind: "Architecture", to: "/architecture-portfolio", img: "/examples/architecture-cover.webp" },
  { key: "graphic", title: "Fieldnotes", kind: "Graphic design", to: "/graphic-design-portfolio", img: "/examples/graphic-design-cover.webp" },
  { key: "photo", title: "Quiet coast", kind: "Photography", to: "/photography-portfolio", img: "/examples/photography-cover.webp" },
  { key: "fashion", title: "Scarlett Bushell", kind: "Fashion lookbook", to: "/p/adu2v", img: "" },
] as const;

export function ExampleGallery({ title, intro, first }: { title: string; intro: string; first?: (typeof EXAMPLES)[number]["key"] }) {
  const items = first ? [...EXAMPLES].sort((a, b) => Number(b.key === first) - Number(a.key === first)) : EXAMPLES;
  return (
    <section className="rule-t">
      <div className="shell max-w-5xl py-14">
        <p className="label-xs">Real examples</p>
        <h2 className="display-title mt-2 text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((e) => (
            <a key={e.key} href={e.key === "fashion" ? e.to : `${e.to}#profession-example`} className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              <span className="block aspect-[600/760] overflow-hidden rounded-xl border border-border bg-[#f4f1e9] shadow-soft transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-1.5deg] group-hover:shadow-lift">
                {e.img ? <img src={e.img} alt={`${e.title}, ${e.kind.toLowerCase()} example portfolio cover`} loading="lazy" width={720} height={912} className="h-full w-full object-contain" />
                  : <span className="flex h-full flex-col items-center justify-center gap-2 bg-[#02011e] p-4 text-center text-white"><span className="display-title text-2xl">{e.title}</span><span className="text-[11px] text-white/70">14-page lookbook</span></span>}
              </span>
              <span className="mt-3 block text-sm font-medium">{e.title}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">{e.kind} <ArrowRight className="size-3 transition group-hover:translate-x-0.5" /></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Closing upload ---------- */

export function ClosingUpload({ title, body, label }: { title: string; body: string; label?: string }) {
  return (
    <section className="rule-t bg-leaf-soft">
      <div className="shell grid max-w-5xl items-center gap-8 py-16 sm:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="display-title text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <IndustryUpload id="upload-again" label={label} />
      </div>
    </section>
  );
}

/* ---------- PDF to link: what the recipient sees ---------- */

export function RecipientPreview() {
  return (
    <section className="rule-t">
      <div className="shell grid max-w-5xl items-center gap-10 py-14 sm:grid-cols-2">
        <div className="mx-auto w-full max-w-[17rem] rounded-[2.2rem] border-[10px] border-[#1d211f] bg-[#ecebe5] p-4 shadow-lift">
          <p className="text-center text-[10px] text-muted-foreground">Today 09:41</p>
          <p className="ml-auto mt-3 w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-leaf px-3 py-2 text-xs text-background">Here’s my portfolio, it opens right in your browser 👇</p>
          <Link to="/p/$slug" params={{ slug: "sample" }} search={{ demo: "book" }} className="ml-auto mt-2 block w-[85%] overflow-hidden rounded-2xl rounded-br-sm bg-background text-left shadow-soft transition hover:-translate-y-0.5">
            <span className="flex aspect-[4/3] items-center justify-center bg-[#02011e] text-white"><span className="display-title text-xl">Scarlett Bushell</span></span>
            <span className="block px-3 py-2"><span className="block text-xs font-medium">Scarlett Bushell · Portfolio</span><span className="block text-[10px] text-muted-foreground">portfolia.site</span></span>
          </Link>
          <p className="mt-3 text-center text-[10px] text-muted-foreground">Tap the card to open the live example</p>
        </div>
        <div>
          <p className="label-xs">What they see</p>
          <h2 className="display-title mt-2 text-3xl">A preview card, then your pages</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Paste your link into WhatsApp, iMessage, LinkedIn or email and it shows as a card with your title. One tap opens the viewer: no app, no download, no “file too large”.</p>
          <ul className="mt-5 space-y-2 text-sm">{["Opens on phones, tablets and laptops", "Same link after you replace the PDF", "Downloads only if you allow them"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-leaf" />{t}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- How to send: email builder and comparison ---------- */

type Purpose = "job" | "client" | "followup";
const PURPOSES: { id: Purpose; label: string }[] = [{ id: "job", label: "Job application" }, { id: "client", label: "Client or pitch" }, { id: "followup", label: "Follow-up" }];

function draft(p: Purpose, f: { you: string; them: string; role: string; link: string }) {
  const you = f.you.trim() || "Your name", them = f.them.trim() || "there", role = f.role.trim() || (p === "client" ? "your project" : "the role"), link = f.link.trim() || "portfolia.site/yourname";
  if (p === "client") return {
    subject: `Portfolio and similar work, ${you}`,
    body: `Hi ${them},\n\nThanks for your time. Here is my portfolio so you can see work similar to ${role}:\n${link}\n\nIt opens in your browser on any device, with nothing to download. The most relevant projects are near the start.\n\nHappy to talk through budget and timings whenever suits you.\n\nBest wishes,\n${you}`,
  };
  if (p === "followup") return {
    subject: `Following up: ${role}, ${you}`,
    body: `Hi ${them},\n\nI wanted to follow up on my application for ${role}. My portfolio is here if it is useful:\n${link}\n\nI have added a recent project since I last wrote, and the link always shows the latest version.\n\nThank you for considering me.\n\nBest wishes,\n${you}`,
  };
  return {
    subject: `Portfolio: ${role} application, ${you}`,
    body: `Hi ${them},\n\nI am applying for ${role} and would love you to see my portfolio:\n${link}\n\nIt opens in your browser on any device, with nothing to download. The projects most relevant to this role come first.\n\nI would be glad to talk it through whenever suits you.\n\nBest wishes,\n${you}`,
  };
}

export function EmailBuilder() {
  const [purpose, setPurpose] = useState<Purpose>("job");
  const [f, setF] = useState({ you: "", them: "", role: "", link: "" });
  const [copied, setCopied] = useState(false);
  const d = useMemo(() => draft(purpose, f), [purpose, f]);
  const field = (k: keyof typeof f, label: string, placeholder: string) => (
    <label className="block text-xs text-muted-foreground">{label}
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-leaf" />
    </label>
  );
  const copy = () => { void navigator.clipboard?.writeText(`Subject: ${d.subject}\n\n${d.body}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); };
  return (
    <section className="rule-t" id="email-template">
      <div className="shell max-w-5xl py-14">
        <p className="label-xs">Free tool</p>
        <h2 className="display-title mt-2 text-3xl">Write your portfolio email in 30 seconds</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Fill in the gaps and copy the result. Nothing you type leaves your browser.</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div role="radiogroup" aria-label="What is the email for?" className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => <button key={p.id} type="button" role="radio" aria-checked={purpose === p.id} onClick={() => setPurpose(p.id)} className={`rounded-full border px-3 py-1.5 text-xs transition ${purpose === p.id ? "border-leaf bg-leaf text-background" : "border-border hover:bg-accent"}`}>{p.label}</button>)}
            </div>
            {field("them", "Their first name", "Alex")}
            {field("role", purpose === "client" ? "The project" : "The role", purpose === "client" ? "your new packaging range" : "the Junior Designer role")}
            {field("you", "Your name", "Jamie Rivera")}
            {field("link", "Your portfolio link", "portfolia.site/yourname")}
            <p className="text-xs text-muted-foreground">No link yet? <a href="#upload" className="text-leaf underline underline-offset-4">Get one free in two minutes</a>.</p>
          </div>
          <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-lift">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground"><Mail className="size-4" /><span className="truncate"><b className="font-medium text-foreground">Subject:</b> {d.subject}</span></div>
            <pre aria-live="polite" className="flex-1 whitespace-pre-wrap px-5 py-4 font-sans text-sm leading-relaxed">{d.body}</pre>
            <div className="flex flex-wrap gap-3 border-t border-border px-5 py-3">
              <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-xs font-medium text-background transition hover:-translate-y-0.5">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy email"}</button>
              <a href={`mailto:?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs hover:bg-accent"><Mail className="size-3.5" />Open in my email app</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LinkVsAttachment() {
  const rows: [string, string, string][] = [
    ["Opens on any phone", "Yes, in the browser", "Needs a PDF app"],
    ["File size limits", "None for the reader", "Gmail 25 MB, Outlook 20 MB"],
    ["Fix a typo after sending", "Replace the PDF, same link", "Send it all again"],
    ["Know it was opened", "Basic visit statistics", "No"],
    ["Company email filters", "Rarely an issue", "Large files often held back"],
  ];
  return (
    <section className="rule-t">
      <div className="shell max-w-4xl py-14">
        <h2 className="display-title text-3xl">Link or attachment?</h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs"><tr><th className="p-3 font-medium" /><th className="p-3 font-medium text-leaf">Portfolio link</th><th className="p-3 font-medium">PDF attachment</th></tr></thead>
            <tbody>{rows.map(([k, a, b]) => <tr key={k} className="border-t border-border"><th className="p-3 font-normal text-muted-foreground">{k}</th><td className="p-3"><span className="inline-flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" />{a}</span></td><td className="p-3 text-muted-foreground">{b}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ---------- Canva: export walkthrough ---------- */

const CANVA_STEPS = [
  { title: "Click Share", body: "Top right of the Canva editor, next to your name.", menu: ["Share", "Present", "Print"], hi: 0 },
  { title: "Choose Download", body: "It sits near the bottom of the Share panel.", menu: ["Copy link", "Download", "Present and record"], hi: 1 },
  { title: "Pick PDF Print", body: "Sharpest images. PDF Standard makes a smaller file if yours is over 10 MB. Leave crop marks and bleed off: they show as white edges in a flipbook.", menu: ["PDF Standard", "PDF Print", "PNG"], hi: 1 },
  { title: "Drop it in", body: "Drop the downloaded PDF into the box on this page to see it as a flipbook straight away.", menu: [], hi: -1 },
];

export function CanvaSteps() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || reducedMotion()) return;
    const t = setInterval(() => setStep((s) => (s + 1) % CANVA_STEPS.length), 3500);
    return () => clearInterval(t);
  }, [auto]);
  const s = CANVA_STEPS[step]!;
  return (
    <section className="rule-t">
      <div className="shell max-w-5xl py-14">
        <p className="label-xs">Step by step</p>
        <h2 className="display-title mt-2 text-3xl">From Canva to flipbook in four clicks</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <ol className="space-y-2">
            {CANVA_STEPS.map((c, i) => (
              <li key={c.title}>
                <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => { setAuto(false); setStep(i); }} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${i === step ? "border-leaf bg-leaf-soft" : "border-border hover:bg-accent"}`}>
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${i === step ? "bg-leaf text-background" : "bg-muted"}`}>{i + 1}</span>{c.title}
                </button>
              </li>
            ))}
          </ol>
          <div key={step} className="soft-in rounded-3xl border border-border bg-card p-6 shadow-soft">
            <p className="text-base font-medium">{s.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            {s.menu.length ? (
              <div className="mt-6 w-full max-w-xs rounded-xl border border-border bg-background p-2 shadow-lift" aria-hidden>
                {s.menu.map((m, i) => <div key={m} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${i === s.hi ? "bg-leaf text-background" : "text-muted-foreground"}`}>{m}{i === s.hi && <ArrowRight className="size-3.5" />}</div>)}
              </div>
            ) : <a href="#upload" className="mt-6 inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-3 text-sm text-background">Drop my Canva PDF <ArrowRight className="size-4" /></a>}
            <p className="mt-6 text-xs text-muted-foreground">Menu names can shift slightly as Canva updates its editor.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- UCAS: readiness checklist ---------- */

const UCAS_CHECKS = [
  "Your strongest, most relevant project comes first",
  "You show process as well as outcomes: sketchbook pages, tests, development",
  "Each project has a short caption: brief, media, what you did",
  "You include the range of media and approaches the course asks for",
  "You have checked each university’s page limit and format",
  "Your name and contact details are on the first page",
  "Text is still readable when you open it on a phone",
  "The file is under 10 MB (the upload box can shrink it for you)",
];

export function UcasChecklist() {
  const [done, setDone] = useState<boolean[]>(() => UCAS_CHECKS.map(() => false));
  const count = done.filter(Boolean).length, all = count === UCAS_CHECKS.length;
  return (
    <section className="rule-t">
      <div className="shell grid max-w-5xl gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="label-xs">Before you apply</p>
          <h2 className="display-title mt-2 text-3xl">Is your portfolio ready?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Tick off what admissions tutors commonly look for. Always follow each course’s own instructions first.</p>
          <div className="mt-6" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-leaf transition-all duration-500" style={{ width: `${(count / UCAS_CHECKS.length) * 100}%` }} /></div>
            <p className="mt-2 text-xs text-muted-foreground">{count} of {UCAS_CHECKS.length} done</p>
          </div>
          {all && <div className="soft-in mt-6 rounded-2xl border border-leaf bg-leaf-soft p-5 text-sm"><p className="font-medium">Ready to share. 🎉</p><p className="mt-1 text-muted-foreground">Turn it into one link for applications and a QR code for interviews.</p><a href="#upload" className="mt-3 inline-flex items-center gap-2 text-leaf underline underline-offset-4">Preview my portfolio <ArrowRight className="size-3.5" /></a></div>}
        </div>
        <ul className="space-y-2">
          {UCAS_CHECKS.map((c, i) => (
            <li key={c}>
              <label className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 text-sm transition ${done[i] ? "border-leaf bg-leaf-soft" : "border-border hover:bg-accent"}`}>
                <input type="checkbox" checked={done[i]} onChange={() => setDone(done.map((d, j) => (j === i ? !d : d)))} className="mt-0.5 size-4 shrink-0 accent-[var(--color-leaf)]" />
                <span className={done[i] ? "text-muted-foreground line-through decoration-leaf/50" : ""}>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function UcasUses() {
  const uses = [
    { title: "Where a link is accepted", body: "Some universities ask for a portfolio link after you apply, through their own portal or by email. Paste your one link and it opens on any device." },
    { title: "At interview", body: "Open it full screen as a book, or hand over the QR code printed on your CV so tutors can look again later." },
    { title: "Between applications", body: "Update the PDF for each course and the same link shows the latest version. Personal lets you keep a version per university." },
  ];
  return (
    <section className="rule-t">
      <div className="shell grid max-w-5xl gap-5 py-14 sm:grid-cols-3">
        {uses.map((u, i) => <div key={u.title} className="rounded-3xl border border-border bg-card p-6 shadow-soft"><span className="flex size-8 items-center justify-center rounded-full bg-leaf-soft text-sm font-medium text-leaf">{i + 1}</span><h3 className="mt-4 text-base font-medium">{u.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{u.body}</p></div>)}
      </div>
    </section>
  );
}
