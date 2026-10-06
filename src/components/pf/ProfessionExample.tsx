import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { DEFAULT_VIEWER } from '@/lib/portfolia/store';
import type { ProfessionGuide } from '@/lib/portfolia/profession-guides';
const Reader=lazy(()=>import('./PdfViewer').then(m=>({default:m.PdfViewer})));
const FashionReader=lazy(()=>import('./StudioDemo').then(m=>({default:m.StudioDemo})));
function FashionCover() {
  const [url,setUrl]=useState<string>();
  useEffect(()=>{let live=true;void Promise.all([import('@/lib/portfolia/public.functions'),import('@/lib/portfolia/share-image')]).then(async([api,images])=>{const data=await api.getPublicPortfolio({data:{by:'code',value:'adu2v'}});if(live&&data)setUrl(images.shareImageUrl(data.portfolio));}).catch(()=>{});return()=>{live=false;};},[]);
  return url ? <img src={url} onError={()=>setUrl(undefined)} alt="Scarlett Bushell fashion lookbook cover" loading="lazy" className="h-full w-full object-contain" /> : <span className="display-title p-6 text-center text-4xl">Scarlett<br/>Bushell</span>;
}
export function ProfessionExample({guide}:{guide:ProfessionGuide}) {
  const [open,setOpen]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(false),[slow,setSlow]=useState(false),[attempt,setAttempt]=useState(0);
  const source=useMemo(()=>({url:`/examples/${guide.kind}.pdf`}),[guide.kind]);
  const onReady=useCallback((value:boolean)=>{if(value)setReady(true);},[]);
  const onError=useCallback(()=>setError(true),[]);
  useEffect(()=>{if(!open||ready||guide.kind==='fashion')return;const t=setTimeout(()=>setSlow(true),30000);return()=>clearTimeout(t);},[open,ready,attempt,guide.kind]);
  return <section id="profession-example" className="rule-t scroll-mt-6">
    <div className="shell max-w-5xl py-12">
      <div className="mb-6 max-w-2xl"><p className="label-xs">{guide.kind==='fashion'?'Featured portfolio':'Demonstration portfolio'}</p><h2 className="display-title mt-2 text-3xl">{guide.exampleTitle}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{guide.exampleDescription}</p></div>
      {!open ? <button type="button" onClick={()=>setOpen(true)} className="group grid w-full items-center gap-8 overflow-hidden rounded-3xl border border-border bg-[#e9e8df] p-6 text-left shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:grid-cols-2 sm:p-10">
        <div className="mx-auto flex aspect-[600/760] w-full max-w-[260px] items-center justify-center overflow-hidden bg-[#f4f1e9] text-[#26352f] shadow-lift sm:rotate-[-3deg]">{guide.kind==='fashion'?<FashionCover/>:<img src={`/examples/${guide.kind}-cover.webp`} alt={`${guide.exampleTitle} — ${guide.kind} demonstration portfolio cover`} loading="lazy" width={720} height={912} className="h-full w-full object-contain"/>}</div>
        <span><span className="display-title block text-3xl text-[#26352f]">Explore the flipbook</span><span className="mt-3 block text-sm text-[#526158]">Turn the pages, switch between Simple and Studio, and try the viewer before uploading your own PDF.</span><span className="mt-6 inline-flex items-center gap-3 rounded-full bg-leaf px-5 py-3 text-sm text-background">Open example <ArrowRight className="size-4"/></span><span className="mt-3 block text-xs text-[#526158]">The interactive reader loads when you open it.</span></span>
      </button> : <Suspense fallback={<div role="status" className="rounded-3xl bg-[#e9e8df] p-16 text-center text-sm">Loading the example reader…</div>}>
        {guide.kind==='fashion'?<FashionReader/>:<div className="relative min-h-[24rem] overflow-hidden rounded-3xl border border-border bg-[#e9e8df] [&_.pf-book-viewport]:h-[26rem] sm:[&_.pf-book-viewport]:h-[34rem]">
          {!error&&<div aria-hidden={!ready} inert={!ready} style={{opacity:ready?1:0}}><Reader key={attempt} source={source} fileName={`${guide.kind}-demonstration.pdf`} viewer={{...DEFAULT_VIEWER,mode:'book',look:'studio',looks:['clean','studio'],background:'paper',backgroundColor:'#e9e8df',studioLighting:'1',studioBrightness:0.58}} projects={[{id:'intro',title:'Introduction',startPage:1,endPage:2},{id:'work',title:'Selected work',startPage:3,endPage:5},{id:'notes',title:'About this example',startPage:6,endPage:6}]} controls lightweight fullSpread onBookReadyChange={onReady} onLoadError={onError}/></div>}
          {(!ready||error)&&<div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#e9e8df] p-8 text-center text-sm text-[#26352f]"><p>{error?'The example could not load.':slow?'Preparing the example is taking longer than usual.':'Preparing the example pages…'}</p>{(error||slow)&&<button type="button" className="underline" onClick={()=>{setReady(false);setError(false);setSlow(false);setAttempt(n=>n+1);}}>Try again</button>}</div>}
        </div>}
      </Suspense>}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{guide.disclosure}</p>
    </div>
  </section>;
}
