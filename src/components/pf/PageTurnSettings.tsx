import { BOOK_STYLES, readableBookStyle } from "@/lib/portfolia/book-style";
import { TURN_CURVES, readableTurnCurve } from "@/lib/portfolia/turn-curve";
import { useEffect } from "react";
import { TURN_STYLES, readableTurnSpeed, readableTurnStyle } from "@/lib/portfolia/turn-motion";
import { setPreviewMode } from "@/lib/portfolia/preview-look";
import type { ViewerSettings } from "@/lib/portfolia/store";
import { RIBBON_COLOURS, readableRibbonColour } from "@/lib/portfolia/book-details";

const RIBBON_NAMES: Record<string, string> = { "#8c1d2c": "Deep red", "#1f3a5f": "Navy", "#2f5d3a": "Forest green", "#c9a227": "Gold", "#1c1c1c": "Black", "#efe9dc": "Ivory" };

export function PageTurnSettings({viewer,setViewer,pages=0}:{viewer:ViewerSettings;setViewer:(patch:Partial<ViewerSettings>)=>boolean;pages?:number}) {
  useEffect(()=>()=>setPreviewMode(null),[]);
  const style=readableTurnStyle(viewer.turnStyle), speed=readableTurnSpeed(viewer.turnSpeed);
  return <fieldset className="space-y-3 border-t border-border pt-3">
    <legend className="pt-3 font-medium">Book style &amp; page turns</legend>
    <p className="text-sm font-medium">Book style</p>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Book style">
      {BOOK_STYLES.map(option=><button key={option.id} type="button" aria-pressed={readableBookStyle(viewer.bookStyle)===option.id}
        className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-foreground"
        onClick={()=>{setPreviewMode("book");setViewer({bookStyle:option.id});}}>{option.label}</button>)}
    </div>
    <p className="text-xs text-muted-foreground">{BOOK_STYLES.find(option=>option.id===readableBookStyle(viewer.bookStyle))!.description}</p>
    {readableBookStyle(viewer.bookStyle)!=="flipbook" && <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Ribbon bookmark</span>
        <input type="checkbox" role="switch" className="size-4 accent-leaf" checked={viewer.ribbon===true} onChange={event=>{setPreviewMode("book");setViewer({ribbon:event.target.checked});}} />
      </label>
      {viewer.ribbon===true && pages>1 && <label className="flex items-center justify-between gap-3 text-sm">
        <span>Marks</span>
        <select aria-label="Page the ribbon marks" className="max-w-[10rem] rounded border border-border bg-background p-1.5 text-sm" value={viewer.ribbonPage ?? ""}
          onChange={event=>{setPreviewMode("book");setViewer({ribbonPage:event.target.value?Number(event.target.value):undefined});}}>
          <option value="">No page (tail only)</option>
          {Array.from({length:pages},(_,i)=><option key={i+1} value={i+1}>{i===0?"Page 1 (cover: marks the first spread)":`Page ${i+1}`}</option>)}
        </select>
      </label>}
      {viewer.ribbon===true && viewer.ribbonPage!==undefined && <p className="text-xs text-muted-foreground">The ribbon lies across that spread when it is open, and shows between the pages everywhere else.</p>}
      {(viewer.ribbon===true||readableBookStyle(viewer.bookStyle)==="hardback") && <div>
        <p className="text-xs text-muted-foreground">{readableBookStyle(viewer.bookStyle)==="hardback"?"Ribbon and headband colour":"Ribbon colour"}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Ribbon colour">
          {RIBBON_COLOURS.map(colour=><button key={colour} type="button" role="radio" aria-checked={readableRibbonColour(viewer.ribbonColour)===colour} aria-label={RIBBON_NAMES[colour]} title={RIBBON_NAMES[colour]}
            className="size-7 rounded-full border border-black/15 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-2" style={{background:colour}}
            onClick={()=>{setPreviewMode("book");setViewer({ribbonColour:colour});}} />)}
        </div>
      </div>}
    </div>}
    <p className="text-sm font-medium">Page curve</p>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Page-curve shape">
      {TURN_CURVES.map(option=><button key={option.id} type="button" aria-pressed={readableTurnCurve(viewer.turnCurve)===option.id}
        className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-foreground"
        onClick={()=>{setPreviewMode("book");setViewer({turnCurve:option.id});}}>{option.label}</button>)}
    </div>
    <p className="text-xs text-muted-foreground">{TURN_CURVES.find(option=>option.id===readableTurnCurve(viewer.turnCurve))!.description}</p>
    <p className="text-sm font-medium">Motion</p>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Page-turn style">
      {TURN_STYLES.map(option=><button key={option.id} type="button" aria-pressed={style===option.id}
        className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-foreground"
        onClick={()=>{setPreviewMode("book");setViewer({turnStyle:option.id});}}>{option.label}</button>)}
    </div>
    <p className="text-xs text-muted-foreground">{TURN_STYLES.find(option=>option.id===style)!.description} Turn a page in the preview to try it.</p>
    <label className="block space-y-2">
      <span>Turn speed · {speed.toFixed(2).replace(/0$/,"")}×</span>
      <input type="range" aria-label="Page-turn speed" min="50" max="200" step="5" value={Math.round(speed*100)}
        className="w-full accent-leaf" onChange={event=>{setPreviewMode("book");setViewer({turnSpeed:Number(event.target.value)/100});}} />
      <span className="flex justify-between text-xs text-muted-foreground"><span>Slower</span><span>Faster</span></span>
    </label>
    <button type="button" className="text-xs underline underline-offset-2" onClick={()=>setViewer({turnStyle:"classic",turnSpeed:1,turnCurve:"classic"})}>Reset page turns</button>
    <p className="text-xs text-muted-foreground">Applies to Simple and Studio flipbooks. Reduced-motion preferences are respected.</p>
  </fieldset>;
}
