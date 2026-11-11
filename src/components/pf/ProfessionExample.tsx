import { useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { Profession, ProfessionGuide } from '@/lib/portfolia/profession-guides';
import { useHeroExample } from './landing-example-context';

// What each demonstration shows, in the words the guide already uses for it. Plain facts about the example file.
const DEMONSTRATES: Record<Profession, string[]> = {
  architecture: ['Six pages: brief, plan, section, materials and reflection', 'Named projects you can jump between from the Projects menu', 'Simple and Studio views of the same book'],
  'graphic-design': ['Six pages: brief, mark, typography and editorial applications', 'Named projects you can jump between from the Projects menu', 'Simple and Studio views of the same book'],
  photography: ['Six pages: an opening view, a close detail and a quieter closing frame', 'Named projects you can jump between from the Projects menu', 'Simple and Studio views of the same book'],
  fashion: ['A 14-page lookbook shown with its saved presentation settings', 'Simple and Studio views of the same book', 'Open in the hero above: turn the pages there'],
};

function FashionCover() {
  const [url,setUrl]=useState<string>();
  useEffect(()=>{let live=true;void Promise.all([import('@/lib/portfolia/public.functions'),import('@/lib/portfolia/share-image')]).then(async([api,images])=>{const data=await api.getPublicPortfolio({data:{by:'code',value:'adu2v'}});if(live&&data)setUrl(images.shareImageUrl(data.portfolio));}).catch(()=>{});return()=>{live=false;};},[]);
  return url ? <img src={url} onError={()=>setUrl(undefined)} alt="Scarlett Bushell fashion lookbook cover" loading="lazy" className="h-full w-full object-contain" /> : <span className="display-title p-6 text-center text-4xl">Scarlett<br/>Bushell</span>;
}

/**
 * The demonstration portfolio for a profession. It no longer hides behind a click: the cover and what it shows are
 * on the page, and one text link loads this example into the hero's live viewer (a page never mounts a second book).
 * The fashion page already shows its lookbook in the hero, so it has no link.
 */
export function ProfessionExample({guide}:{guide:ProfessionGuide}) {
  const hero=useHeroExample();
  const fashion=guide.kind==='fashion';
  return <section id="profession-example" className="rule-t scroll-mt-6">
    <div className="shell max-w-5xl py-12">
      <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-12">
        <div className="mx-auto flex aspect-[600/760] w-full max-w-[260px] items-center justify-center overflow-hidden bg-[#f4f1e9] text-[#26352f] shadow-lift sm:rotate-[-3deg]">{fashion?<FashionCover/>:<img src={`/examples/${guide.kind}-cover.webp`} alt={`${guide.exampleTitle} — ${guide.kind} demonstration portfolio cover`} loading="lazy" width={720} height={912} className="h-full w-full object-contain"/>}</div>
        <div className="max-w-2xl">
          <p className="label-xs">{fashion?'Featured portfolio':'Demonstration portfolio'}</p>
          <h2 className="display-title mt-2 text-3xl">{guide.exampleTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{guide.exampleDescription}</p>
          <ul className="mt-5 space-y-2 text-sm">{DEMONSTRATES[guide.kind].map(item=><li key={item} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-leaf"/>{item}</li>)}</ul>
          {!fashion&&hero&&<button type="button" onClick={()=>hero.showExample({url:`/examples/${guide.kind}.pdf`,fileName:`${guide.kind}-demonstration.pdf`})} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-leaf underline underline-offset-4">Open this example <ArrowRight aria-hidden className="size-4"/></button>}
        </div>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{guide.disclosure}</p>
    </div>
  </section>;
}
