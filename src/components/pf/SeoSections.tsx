import { useState } from "react";
import { FeatureClip } from "./Media";

/* Sections below the hero on the SEO pages (plan 2, S4). */

type Poster = "lighting" | "share" | "links" | "paged" | "scroll" | "background" | "tabs";
// A point card gets the poster of the feature clip its words describe; anything else gets the page's cover or nothing.
const POINT_VISUALS: [RegExp, Poster][] = [
  [/light|studio|hdri|3d|paper/i, "lighting"],
  [/link|qr|share|send|embed|email|address/i, "share"],
  [/phone|mobile|scroll|read/i, "scroll"],
  [/page by page|one page/i, "paged"],
  [/background|backdrop|scene/i, "background"],
  [/tab|contents|navigat|project/i, "tabs"],
  [/website|shop|button|click/i, "links"],
];

function pointPoster(text: string): Poster | null {
  return POINT_VISUALS.find(([re]) => re.test(text))?.[1] ?? null;
}

/** The small picture above a point card: a feature poster when the words match, else the discipline cover, else none. */
export function PointVisual({ title, body, cover }: { title: string; body: string; cover?: string }) {
  const poster = pointPoster(`${title} ${body}`);
  if (poster) return <img src={`/features/${poster}-poster.webp`} width={1600} height={1000} alt="" loading="lazy" className="mb-5 aspect-[16/10] w-full rounded-xl bg-[#e9e8df] object-cover" />;
  if (cover) return <img src={cover} width={720} height={912} alt="" loading="lazy" className="mb-5 aspect-[16/10] w-full rounded-xl bg-[#f4f1e9] object-contain" />;
  return null;
}

const MODES = [
  { id: "lighting", label: "Flipbook", text: "A Simple view and a 3D Studio view with paper finishes, room lighting and backdrops.", alt: "A lookbook turning as a lit 3D flipbook" },
  { id: "scroll", label: "Scroll", text: "One continuous column, easy on phones, with selectable text and working links.", alt: "A portfolio read as one scrolling column" },
  { id: "paged", label: "Page by page", text: "Each page on its own screen with a simple slide between them.", alt: "A portfolio read one page at a time" },
] as const;

/** "A simple viewer for a professional presentation", shown with the three reading styles' own clips. */
export function ViewerModes() {
  const [mode, setMode] = useState(0);
  const m = MODES[mode]!;
  return <section aria-labelledby="viewer-modes-title" className="rule-t">
    <div className="shell grid max-w-6xl items-center gap-10 py-16 sm:py-24 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h2 id="viewer-modes-title" className="display-title text-3xl sm:text-4xl">A simple viewer for a professional presentation</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">Choose how people read. On phones, the book camera follows the current page.</p>
        <div role="radiogroup" aria-label="Reading style" className="mt-6 inline-flex rounded-full border border-border p-1">
          {MODES.map((x, i) => <button key={x.id} type="button" role="radio" aria-checked={mode === i} onClick={() => setMode(i)} className={`rounded-full px-4 py-1.5 text-sm transition-colors ${mode === i ? "bg-foreground text-background" : "hover:bg-muted"}`}>{x.label}</button>)}
        </div>
        <p aria-live="polite" className="mt-4 max-w-md text-[15px] leading-relaxed">{m.text}</p>
        <p className="mt-6 text-sm">Start free with one PDF up to 30 MB. <a href="/free-pdf-flipbook" className="underline underline-offset-4">Explore the free PDF flipbook</a> or <a href="/pricing" className="underline underline-offset-4">see the plans</a>.</p>
      </div>
      <div className="aspect-[16/10] overflow-hidden rounded-3xl bg-[#e9e8df] shadow-soft">
        <FeatureClip key={m.id} name={m.id} alt={m.alt} className="h-full w-full object-cover" />
      </div>
    </div>
  </section>;
}
