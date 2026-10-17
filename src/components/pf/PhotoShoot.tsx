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
  const [options,setOptions]=useState<ShootOptions>({style:readableBookStyle(p.viewer?.bookStyle),colour:"#ded9cf",yaw:20,elevation:10,zoom:1});
  const latest=useRef(options);latest.current=options;
  const [error,setError]=useState(""),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[upload,setUpload]=useState<string>();
  useEffect(()=>()=>{if(upload)URL.revokeObjectURL(upload);},[upload]);
  useEffect(()=>{
    let cancelled=false,task:ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>|undefined;
    let view:ReturnType<typeof createPhotoShoot>|undefined;
    setReady(false);setError("");
    void (async()=>{
      const blob=await getBlob(p.pdf!.blobKey);if(!blob)throw new Error("The PDF is unavailable. Reopen the portfolio and try again.");
      const data=new Uint8Array(await blob.arrayBuffer()),pdfjs=await loadPdfjs();if(cancelled)return;
      task=pdfjs.getDocument({data});const doc=await task.promise;
      const render=async(pageNumber:number)=>{
        const page=await doc.getPage(pageNumber),native=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(2,1800/Math.max(native.width,native.height))});
        const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext("2d")!,viewport,background:"#ffffff"}).promise;return canvas;
      };
      const front=await render(1),last=doc.numPages===1?front:await render(doc.numPages);
      const back=document.createElement("canvas");back.width=front.width;back.height=front.height;
      const ctx=back.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,back.width,back.height);
      const scale=Math.min(back.width/last.width,back.height/last.height);ctx.drawImage(last,(back.width-last.width*scale)/2,(back.height-last.height*scale)/2,last.width*scale,last.height*scale);
      if(cancelled)return;
      try{view=createPhotoShoot(host.current!,front,back,doc.numPages,message=>{if(!cancelled)setError(message);});}catch{throw new Error("3D graphics could not start on this device. Try a browser with WebGL enabled.");}
      stage.current=view;view.set(latest.current);setReady(true);
    })().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"The photo shoot could not load.");}).finally(()=>{void task?.destroy();});
    return ()=>{cancelled=true;view?.dispose();stage.current=null;void task?.destroy();};
  },[p.pdf?.blobKey]);
  useEffect(()=>{stage.current?.set(options);},[options]);
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
        <p className="text-muted-foreground">Your book against a wall. Drag the preview or use the camera controls. The first and last PDF pages provide the cover artwork; the spine uses the cover colour.</p>
        <label className="block space-y-2"><span>Book style</span><select aria-label="Photo shoot book style" value={options.style} onChange={e=>change({style:readableBookStyle(e.target.value)})} className="w-full rounded border border-border bg-background p-2">{BOOK_STYLES.map(style=><option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
        <label className="flex items-center justify-between">Wall &amp; floor colour<input aria-label="Photo shoot wall colour" type="color" value={options.colour} onChange={e=>change({colour:e.target.value,wall:undefined})}/></label>
        <label className="block space-y-2"><span>Wall background</span><select aria-label="Photo shoot wall background" value={options.wall??""} onChange={e=>change({wall:e.target.value||undefined})} className="w-full rounded border border-border bg-background p-2"><option value="">Solid colour</option>{BACKGROUND_PRESETS.map(background=><option key={background.id} value={background.url}>{background.label}</option>)}{upload&&<option value={upload}>Uploaded picture</option>}</select></label>
        <label className="block space-y-2"><span>Upload a wall picture</span><input type="file" accept="image/*" className="w-full text-xs" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")||file.size>15*1048576){setError("Choose a picture up to 15 MB.");return;}const url=URL.createObjectURL(file);setUpload(url);change({wall:url});}}/></label>
        {([["yaw","Camera angle",-40,40,1],["elevation","Camera height",2,25,1],["zoom","Framing",.7,1.4,.05]] as const).map(([key,label,min,max,step])=><label key={key} className="block space-y-2"><span>{label} · {options[key].toFixed(key==="zoom"?2:0)}{key==="zoom"?"×":"°"}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={options[key]} onChange={e=>change({[key]:Number(e.target.value)})} className="w-full accent-blue-600"/></label>)}
        <Button variant="line" size="sm" onClick={()=>change({yaw:20,elevation:10,zoom:1})}><RotateCcw className="size-4"/>Reset camera</Button>
        <Button className="w-full" disabled={!ready||saving} onClick={()=>void download()}><Download className="size-4"/>{saving?"Preparing PNG…":"Download photograph"}</Button>
        <p className="text-xs text-muted-foreground">Portrait PNG, up to 2048 × 2560. Photo shoot choices stay here and do not change your saved portfolio.</p>
        {ready&&error&&<p role="alert" className="text-destructive">{error}</p>}
      </div>
    </div>
  </section>;
}
