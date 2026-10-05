import { useState } from "react";
import { Link } from "@tanstack/react-router";

import featurePaged from "@/assets/feature-paged.svg";
import featurePagedStill from "@/assets/feature-paged-still.png";
import featureScroll from "@/assets/feature-scroll.svg";
import featureScrollStill from "@/assets/feature-scroll-still.png";
import featureBackground from "@/assets/feature-background.svg";
import featureBackgroundStill from "@/assets/feature-background-still.png";
import featureLighting from "@/assets/feature-lighting.svg";
import featureLightingStill from "@/assets/feature-lighting-still.png";
import featureShare from "@/assets/feature-share.svg";
import featureShareStill from "@/assets/feature-share-still.png";
import featureEmbed from "@/assets/feature-embed.svg";
import featureEmbedStill from "@/assets/feature-embed-still.png";

const FEATURES = [
  { id: "paged", label: "Page by page", title: "Give every page its moment.", text: "A focused single-page view with previous and next controls. Ideal when you want readers to pause over one project at a time.", image: featurePaged, still: featurePagedStill, alt: "A portfolio page shown one at a time on a tablet, with previous and next controls." },
  { id: "scroll", label: "Scroll", title: "A smooth read from start to finish.", text: "Keep your original layouts in one continuous column. Scroll and Page by page also preserve selectable text and clickable PDF links.", image: featureScroll, still: featureScrollStill, alt: "A continuous scrolling portfolio page with stacked photography and generous white space." },
  { id: "background", label: "Your backdrop", title: "Set the scene for your work.", text: "Choose a colour or upload your own background image, then adjust its position and scale. Keep the portfolio’s surroundings as considered as its pages. Personal also adds profile colours, heading fonts and a cover image.", image: featureBackground, still: featureBackgroundStill, alt: "A portfolio page floating over soft sage and sand colour backdrops beside a colour palette." },
  { id: "lighting", label: "Studio lighting", title: "Paper, light and a little atmosphere.", text: "Choose the Studio HDRI lighting and paper finish that suit your work. Keep the same saved settings while visitors switch between Simple and Studio.", image: featureLighting, still: featureLightingStill, alt: "An open printed portfolio photographed under warm studio lighting with visible paper texture." },
  { id: "share", label: "Easy sharing", title: "One link. Plenty of possibilities.", text: "Send your portfolio in an application, email or message. Download a QR code for cards and exhibitions. Replace the PDF later without changing the link.", image: featureShare, still: featureShareStill, alt: "A business card with a QR code beside a phone showing a portfolio link." },
  { id: "embed", label: "Embed anywhere it fits", title: "Your portfolio, inside your website.", text: "Copy an embed code from your published portfolio and paste it into a supported HTML block. Embedding is included on Free; your website provider may have its own plan restrictions.", image: featureEmbed, still: featureEmbedStill, alt: "A laptop on a desk showing a personal website with an embedded portfolio book." },
] as const;

export function FeatureShowcase() {
  const [selected, setSelected] = useState(0);
  const feature = FEATURES[selected]!;
  return <section className="rule-t"><div className="shell py-16">
    <h2 className="display-title text-3xl sm:text-4xl">More ways to make it yours.</h2>
    <p className="mt-3 max-w-xl text-sm text-muted-foreground">From the first page to the link you send. Choose a feature to take a closer look.</p>
    <div role="tablist" aria-label="Portfolio features" className="mt-7 flex flex-wrap gap-2">
      {FEATURES.map((item, i) => <button key={item.id} id={`feature-tab-${item.id}`} role="tab" aria-selected={selected === i} aria-controls={`feature-panel-${item.id}`} tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={(e) => {
        const next = e.key === "ArrowRight" ? (i + 1) % FEATURES.length : e.key === "ArrowLeft" ? (i + FEATURES.length - 1) % FEATURES.length : e.key === "Home" ? 0 : e.key === "End" ? FEATURES.length - 1 : null;
        if (next !== null) { e.preventDefault(); setSelected(next); document.getElementById(`feature-tab-${FEATURES[next]!.id}`)?.focus(); }
      }} className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 ${selected === i ? "border-leaf bg-leaf text-white" : "border-border hover:bg-muted"}`}>{item.label}</button>)}
    </div>
    <div id={`feature-panel-${feature.id}`} role="tabpanel" aria-labelledby={`feature-tab-${feature.id}`} tabIndex={0} className="mt-7 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
      <picture><source media="(prefers-reduced-motion: reduce)" srcSet={feature.still} /><img src={feature.image} alt={feature.alt} width={1200} height={784} loading="lazy" decoding="async" className="w-full h-auto rounded-3xl shadow-lift" /></picture>
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{feature.label}</p><h3 className="display-title mt-3 text-3xl">{feature.title}</h3><p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{feature.text}</p><Link to="/" hash="upload" className="mt-6 inline-block text-sm font-medium text-leaf underline underline-offset-4">Try it with your PDF →</Link><p className="mt-5 text-xs text-muted-foreground">Illustrative previews. Your uploaded pages keep their own design.</p></div>
    </div>
  </div></section>;
}
