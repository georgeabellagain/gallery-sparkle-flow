import { useState } from "react";
import { Link } from "@tanstack/react-router";

const FEATURES = [
  { id: "paged", label: "Page by page", title: "Give every page its moment.", text: "A focused single-page view with previous and next controls. Ideal when you want readers to pause over one project at a time.", colour: "#e9a6a0" },
  { id: "scroll", label: "Scroll", title: "A smooth read from start to finish.", text: "Keep your original layouts in one continuous column. Scroll and Page by page also preserve selectable text and clickable PDF links.", colour: "#c8c7ed" },
  { id: "background", label: "Your backdrop", title: "Set the scene for your work.", text: "Choose a colour or upload your own background image, then adjust its position and scale. Keep the portfolio’s surroundings as considered as its pages. Personal also adds profile colours, heading fonts and a cover image.", colour: "#b8ccb2" },
  { id: "lighting", label: "Studio lighting", title: "Paper, light and a little atmosphere.", text: "Choose the Studio HDRI lighting and paper finish that suit your work. Keep the same saved settings while visitors switch between Simple and Studio.", colour: "#edd39e" },
  { id: "share", label: "Easy sharing", title: "One link. Plenty of possibilities.", text: "Send your portfolio in an application, email or message. Download a QR code for cards and exhibitions. Replace the PDF later without changing the link.", colour: "#a8ced2" },
  { id: "embed", label: "Embed anywhere it fits", title: "Your portfolio, inside your website.", text: "Copy an embed code from your published portfolio and paste it into a supported HTML block. Embedding is included on Free; your website provider may have its own plan restrictions.", colour: "#e6b4ce" },
] as const;

/** Small code-native illustrations stay crisp without photo downloads or fake customer work. */
function FeatureArt({ kind, colour }: { kind: string; colour: string }) {
  const page = (x: number, y: number, w: number, h: number, n = "01") => <g>
    <rect x={x + 6} y={y + 9} width={w} height={h} rx="5" fill="#172b36" opacity=".12" />
    <rect x={x} y={y} width={w} height={h} rx="5" fill="#fffaf0" />
    <rect x={x + 12} y={y + 12} width={w - 24} height={h * .58} fill="#ec715b" />
    <ellipse cx={x + w * .58} cy={y + h * .29} rx={w * .2} ry={h * .21} fill="#4e6578" />
    <path d={`M${x + 12} ${y + h * .6} Q${x + w * .5} ${y + h * .15} ${x + w - 12} ${y + h * .6}`} fill="#ecc762" />
    <text x={x + 14} y={y + h * .79} fontSize={w * .1} fill="#233740" fontFamily="Georgia,serif">FORM / {n}</text>
    <path d={`M${x + 14} ${y + h * .88} h${w * .5} M${x + 14} ${y + h * .93} h${w * .33}`} stroke="#758182" strokeWidth="2" />
  </g>;
  return <svg viewBox="0 0 600 390" className="h-auto w-full" aria-hidden="true">
    <rect width="600" height="390" rx="26" fill={colour} />
    <circle cx="530" cy="40" r="125" fill="#fff" opacity=".22" /><circle cx="30" cy="360" r="125" fill="#fff" opacity=".18" />
    {kind === "paged" && <>{page(196, 36, 208, 282, "02")}<rect x="218" y="338" width="164" height="30" rx="15" fill="#233740" /><text x="300" y="358" textAnchor="middle" fill="white" fontSize="14">←　 2 / 14　 →</text><path d="M115 170l-17 17 17 17m370-34 17 17-17 17" stroke="#233740" fill="none" strokeWidth="4" /></>}
    {kind === "scroll" && <><rect x="166" y="20" width="268" height="350" rx="14" fill="#233740" />{page(195, 39, 210, 190)}{page(195, 242, 210, 116, "03")}<rect x="420" y="55" width="4" height="95" rx="2" fill="white" opacity=".65" /></>}
    {kind === "background" && <><path d="M0 270Q100 155 210 270T430 250T600 190V390H0Z" fill="#70836a" /><path d="M0 325Q180 210 325 325T600 290V390H0Z" fill="#d5ad78" />{page(206, 48, 190, 265)}<rect x="56" y="80" width="104" height="46" rx="23" fill="#fffaf0" />{['#02011e','#ece0ce','#668671'].map((c,i)=><circle key={c} cx={79+i*30} cy="103" r="10" fill={c}/>)}<path d="M425 254h80m-55-25v50" stroke="#fffaf0" strokeWidth="5" /></>}
    {kind === "lighting" && <><rect x="55" y="30" width="118" height="160" rx="6" fill="#fff7db" /><path d="M114 30v160M55 108h118" stroke="#9c8b61" strokeWidth="7" /><path d="M64 191L340 378H575L174 191Z" fill="#fff7db" opacity=".5" /><g transform="translate(286 90) rotate(12)">{page(-75, 0, 158, 235)}{page(88, 0, 158, 235, "02")}</g><path d="M72 285h92" stroke="#233740" strokeWidth="5" strokeLinecap="round" /><circle cx="124" cy="285" r="12" fill="#fffaf0" /></>}
    {kind === "share" && <><g transform="rotate(-9 205 190)">{page(115, 44, 190, 267)}</g><rect x="334" y="58" width="205" height="64" rx="18" fill="#fffaf0" /><text x="356" y="96" fill="#233740" fontSize="18">Your work ↗</text><rect x="352" y="176" width="150" height="150" rx="12" fill="#fffaf0" />{[[368,192],[438,192],[368,262]].map(([x,y])=><g key={`${x}${y}`}><rect x={x} y={y} width="48" height="48" rx="4" fill="#233740" /><rect x={x!+10} y={y!+10} width="28" height="28" fill="#fffaf0" /><rect x={x!+17} y={y!+17} width="14" height="14" fill="#233740" /></g>)}<path d="M443 267h33v34h-15v-16h-18z" fill="#233740" /><text x="430" y="355" textAnchor="middle" fontSize="12" fill="#233740">QR illustration</text></>}
    {kind === "embed" && <><rect x="62" y="39" width="476" height="310" rx="16" fill="#fffaf0" /><path d="M62 76h476" stroke="#d4c7bf" /><circle cx="85" cy="58" r="5" fill="#eb7963" /><circle cx="104" cy="58" r="5" fill="#e9c95a" /><circle cx="123" cy="58" r="5" fill="#7fa082" /><rect x="80" y="98" width="144" height="12" rx="6" fill="#233740" /><rect x="80" y="124" width="104" height="7" rx="3" fill="#b8b9af" /><text x="86" y="219" fontSize="48" fill="#668671">&lt;/&gt;</text>{page(271, 96, 178, 232)}</>}
  </svg>;
}

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
      <FeatureArt kind={feature.id} colour={feature.colour} />
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{feature.label}</p><h3 className="display-title mt-3 text-3xl">{feature.title}</h3><p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{feature.text}</p><Link to="/" hash="upload" className="mt-6 inline-block text-sm font-medium text-leaf underline underline-offset-4">Try it with your PDF →</Link><p className="mt-5 text-xs text-muted-foreground">Illustrative previews. Your uploaded pages keep their own design.</p></div>
    </div>
  </div></section>;
}
