import { coverLeaf } from "@/lib/portfolia/rigid-cover";
import { photoLighting, photoSpreadPages } from "@/lib/portfolia/photo-settings";
import { PAPER_STYLES } from "@/lib/portfolia/surface";
import { useEffect, useRef, useState } from "react";
import { X, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlob } from "@/lib/portfolia/assets";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { BOOK_STYLES, readableBookStyle } from "@/lib/portfolia/book-style";
import { BACKGROUND_PRESETS } from "@/lib/portfolia/background-presets";
import { createPhotoShoot, type ShootOptions } from "@/lib/portfolia/photo-shoot";
import type { Portfolio } from "@/lib/portfolia/store";

export function PhotoShoot({p,onClose}:{p:Portfolio;onClose:()=>void}){
  const host=useRef<HTMLDivElement>(null),stage=useRef<ReturnType<typeof createPhotoShoot>|null>(null);
  const [options,setOptions]=useState<ShootOptions>({style:readableBookStyle(p.viewer?.bookStyle),colour:"#ded9cf",floorColour:"#ded9cf",...photoLighting(p.viewer),yaw:20,elevation:10,zoom:1});
  const latest=useRef(options);latest.current=options;
  const [error,setError]=useState(""),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[uploads,setUploads]=useState<{wall?:string;floor?:string}>({});
  const [selectedPage,setSelectedPage]=useState(0),[spreadBusy,setSpreadBusy]=useState(false),[spreadFailed,setSpreadFailed]=useState(false);
  const pageRenderer=useRef<((page:number)=>Promise<HTMLCanvasElement>)|null>(null),frontRatio=useRef(1);
  const uploadUrls=useRef(new Set<string>());
  useEffect(()=>()=>{uploadUrls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  useEffect(()=>{
    let cancelled=false,task:ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>|undefined;
    let view:ReturnType<typeof createPhotoShoot>|undefined;
    setReady(false);setError("");
    void (async()=>{
      const blob=await getBlob(p.pdf!.blobKey);if(!blob)throw new Error("The PDF is unavailable. Reopen the portfolio and try again.");
      const data=new Uint8Array(await blob.arrayBuffer()),pdfjs=await loadPdfjs();if(cancelled)return;
      task=pdfjs.getDocument({data});const doc=await task.promise;
      const cache=new Map<number,Promise<HTMLCanvasElement>>();
      const render=async(pageNumber:number)=>{
        const hit=cache.get(pageNumber);if(hit)return hit;
        const pending=(async()=>{
        const page=await doc.getPage(pageNumber),native=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(2,1800/Math.max(native.width,native.height))});
        const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext("2d")!,viewport,background:"#ffffff"}).promise;canvas.dataset["pageNumber"]=String(pageNumber);return canvas;
        })();cache.set(pageNumber,pending);while(cache.size>6)cache.delete(cache.keys().next().value!);return pending;
      };
      pageRenderer.current=render;
      const front=await render(1),last=doc.numPages===1?front:await render(doc.numPages);
      frontRatio.current=front.width/front.height;
      const back=document.createElement("canvas");back.width=front.width;back.height=front.height;
      const ctx=back.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,back.width,back.height);
      const scale=Math.min(back.width/last.width,back.height/last.height);ctx.drawImage(last,(back.width-last.width*scale)/2,(back.height-last.height*scale)/2,last.width*scale,last.height*scale);
      if(cancelled)return;
      try{view=createPhotoShoot(host.current!,front,back,doc.numPages,message=>{if(!cancelled)setError(message);},latest.current);}catch{throw new Error("3D graphics could not start on this device. Try a browser with WebGL enabled.");}
      stage.current=view;view.set(latest.current);setReady(true);
    })().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"The photo shoot could not load.");});
    return ()=>{cancelled=true;view?.dispose();stage.current=null;pageRenderer.current=null;void task?.destroy();};
  },[p.pdf?.blobKey]);
  useEffect(()=>{stage.current?.set(options);},[options]);
  useEffect(()=>{setOptions(current=>({...current,...photoLighting(p.viewer)}));},[p.viewer?.studioLighting,p.viewer?.finish,p.viewer?.studioBrightness,p.viewer?.studioLightingStrength,p.viewer?.studioTopLight]);
  useEffect(()=>{
    if(!ready||!stage.current||!pageRenderer.current)return;
    let cancelled=false;setSpreadBusy(true);setSpreadFailed(false);
    if(selectedPage===0){stage.current.setSpread(null);setSpreadBusy(false);return;}
    const render=pageRenderer.current;
    const fit=(source:HTMLCanvasElement,leafIndex=Number(source.dataset["pageNumber"])-1,totalLeaves=p.pdf!.pages)=>{
      const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=Math.round(1000/frontRatio.current);canvas.dataset["coverBoard"]=String(coverLeaf(leafIndex,totalLeaves));const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/source.width,canvas.height/source.height);ctx.drawImage(source,(canvas.width-source.width*scale)/2,(canvas.height-source.height*scale)/2,source.width*scale,source.height*scale);return canvas;
    };
    void (async()=>{
      const selected=await render(selectedPage);
      const split=(p.viewer?.spreads==="ready"&&(selectedPage!==1||selected.width>selected.height))||selected.width/selected.height>frontRatio.current*1.6;
      let canvases:readonly [HTMLCanvasElement|null,HTMLCanvasElement|null];
      if(split){
        const halves=([0,1] as const).map(side=>{const half=document.createElement("canvas");half.width=Math.floor(selected.width/2);half.height=selected.height;half.getContext("2d")!.drawImage(selected,side*half.width,0,half.width,half.height,0,0,half.width,half.height);const mixed=frontRatio.current<1&&selected.width/selected.height>frontRatio.current*1.6;const index=mixed?1+(selectedPage-2)*2+side:(selectedPage-1)*2+side;return fit(half,index,mixed?1+(p.pdf!.pages-1)*2:p.pdf!.pages*2);});canvases=[halves[0]!,halves[1]!];
      }else{
        const pages=photoSpreadPages(selectedPage,p.pdf!.pages);canvases=await Promise.all(pages.map(async page=>page?fit(await render(page)):null)) as [HTMLCanvasElement|null,HTMLCanvasElement|null];
      }
      if(!cancelled)stage.current?.setSpread(canvases);
    })().catch(()=>{if(!cancelled){setSpreadFailed(true);setError("That spread could not be prepared. Choose another page.");}}).finally(()=>{if(!cancelled)setSpreadBusy(false);});
    return()=>{cancelled=true;};
  },[selectedPage,ready,p.pdf?.pages,p.viewer?.spreads]);
  const change=(patch:Partial<ShootOptions>)=>setOptions(current=>({...current,...patch}));
  const download=async()=>{
    if(!stage.current)return;setSaving(true);setError("");
    try{const blob=await stage.current.png();if(!stage.current)return;const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${(p.name||"book").replace(/[^a-zA-Z0-9_-]/g,"-")}-photo.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(e){setError(e instanceof Error?e.message:"Could not export the picture.");}finally{setSaving(false);}
  };
  const drag=useRef<{x:number;y:number;yaw:number;elevation:number}|null>(null);
  return <section aria-label="Book photo shoot" className="absolute inset-0 z-50 flex flex-col bg-background">
    <header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-medium">Photo shoot</h2><Button size="sm" variant="quiet" onClick={onClose}><X className="size-4"/>Close photo shoot</Button></header>
    <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[1fr_19rem]">
      <div className="flex min-h-[26rem] items-center justify-center bg-muted p-4">
        <div className="relative w-full max-w-[44rem]" style={{aspectRatio:"4 / 5",maxHeight:"100%"}}>
          <div ref={host} aria-label="3D book photograph preview" className="absolute inset-0 cursor-grab overflow-hidden rounded-lg"
            onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,yaw:options.yaw,elevation:options.elevation};e.currentTarget.setPointerCapture(e.pointerId);}}
            onPointerMove={e=>{const start=drag.current;if(start)change({yaw:Math.max(-40,Math.min(40,start.yaw+(e.clientX-start.x)*.16)),elevation:Math.max(2,Math.min(25,start.elevation+(e.clientY-start.y)*.1))});}}
            onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}/>
          {!ready&&<p role="status" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm">{error||"Preparing your book…"}</p>}
        </div>
      </div>
      <div className="space-y-5 overflow-auto border-l border-border p-5 text-sm">
        <p className="text-muted-foreground">Your book or selected spread against a wall. Drag the preview or use the camera controls. The first and last PDF pages provide the cover artwork; the spine uses the cover colour.</p>
        <label className="block space-y-2"><span>Book style</span><select aria-label="Photo shoot book style" value={options.style} onChange={e=>change({style:readableBookStyle(e.target.value)})} className="w-full rounded border border-border bg-background p-2">{BOOK_STYLES.map(style=><option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
        <p className="text-xs text-muted-foreground">Using editor HDRI {options.hdri} · {PAPER_STYLES.find(([id])=>id===options.finish)?.[1]??options.finish} paper.</p>
        <label className="block space-y-2"><span>Book presentation</span><select aria-label="Photo shoot page or spread" value={selectedPage} onChange={e=>setSelectedPage(Number(e.target.value))} className="w-full rounded border border-border bg-background p-2"><option value={0}>Closed cover</option>{Array.from({length:p.pdf?.pages??0},(_,i)=><option key={i+1} value={i+1}>Page {i+1} · show its spread</option>)}</select></label>
        {spreadBusy&&<p role="status">Preparing spread…</p>}
        {(["wall","floor"] as const).map(target=>{
          const label=target==="wall"?"Wall":"Floor",colourKey=target==="wall"?"colour":"floorColour";
          return <fieldset key={target} className="space-y-3 border-t border-border pt-3"><legend className="font-medium">{label}</legend>
            <label className="flex items-center justify-between">{label} colour<input aria-label={`Photo shoot ${target} colour`} type="color" value={options[colourKey]} onChange={e=>change({[colourKey]:e.target.value,[target]:undefined})}/></label>
            <label className="block space-y-2"><span>{label} surface</span><select aria-label={`Photo shoot ${target} background`} value={options[target]??""} onChange={e=>change({[target]:e.target.value||undefined})} className="w-full rounded border border-border bg-background p-2"><option value="">Solid colour</option>{BACKGROUND_PRESETS.map(background=><option key={background.id} value={background.url}>{background.label} · 3D surface</option>)}{uploads[target]&&<option value={uploads[target]}>Uploaded picture</option>}</select></label>
            <label className="block space-y-2"><span>Upload {target} picture</span><input type="file" accept="image/*" className="w-full text-xs" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")||file.size>15*1048576){setError("Choose a picture up to 15 MB.");return;}const url=URL.createObjectURL(file);uploadUrls.current.add(url);setUploads(current=>({...current,[target]:url}));change({[target]:url});}}/></label>
          </fieldset>;
        })}
        {([["yaw","Camera angle",-40,40,1],["elevation","Camera height",2,25,1],["zoom","Framing",.7,1.4,.05]] as const).map(([key,label,min,max,step])=><label key={key} className="block space-y-2"><span>{label} · {options[key].toFixed(key==="zoom"?2:0)}{key==="zoom"?"×":"°"}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={options[key]} onChange={e=>change({[key]:Number(e.target.value)})} className="w-full accent-blue-600"/></label>)}
        <Button variant="line" size="sm" onClick={()=>change({yaw:20,elevation:10,zoom:1})}><RotateCcw className="size-4"/>Reset camera</Button>
        <Button className="w-full" disabled={!ready||saving||spreadBusy||spreadFailed} onClick={()=>void download()}><Download className="size-4"/>{saving?"Preparing PNG…":"Download photograph"}</Button>
        <p className="text-xs text-muted-foreground">Portrait PNG, up to 2048 × 2560. Photo shoot choices stay here and do not change your saved portfolio.</p>
        {ready&&error&&<p role="alert" className="text-destructive">{error}</p>}
      </div>
    </div>
  </section>;
}
