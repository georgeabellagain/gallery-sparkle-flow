import { BOOK_STYLES, readableBookStyle } from "@/lib/portfolia/book-style";
import { TURN_CURVES, readableTurnCurve } from "@/lib/portfolia/turn-curve";
import { useEffect } from "react";
import { TURN_STYLES, readableTurnSpeed, readableTurnStyle } from "@/lib/portfolia/turn-motion";
import { setPreviewMode } from "@/lib/portfolia/preview-look";
import type { ViewerSettings } from "@/lib/portfolia/store";

export function PageTurnSettings({viewer,setViewer}:{viewer:ViewerSettings;setViewer:(patch:Partial<ViewerSettings>)=>boolean}) {
  useEffect(()=>()=>setPreviewMode(null),[]);
  const style=readableTurnStyle(viewer.turnStyle), speed=readableTurnSpeed(viewer.turnSpeed);
  return <fieldset className="space-y-3 border-t border-border pt-3">
    <legend className="pt-3 font-medium">Book style &amp; page turns</legend>
    <p className="text-sm font-medium">Book style</p>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Book style">
      {BOOK_STYLES.map(option=><button key={option.id} type="button" aria-pressed={readableBookStyle(viewer.bookStyle)===option.id}
        className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-blue-600 aria-pressed:bg-blue-50 aria-pressed:text-blue-900"
        onClick={()=>{setPreviewMode("book");setViewer({bookStyle:option.id});}}>{option.label}</button>)}
    </div>
    <p className="text-xs text-muted-foreground">{BOOK_STYLES.find(option=>option.id===readableBookStyle(viewer.bookStyle))!.description}</p>
    <p className="text-sm font-medium">Page curve</p>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Page-curve shape">
      {TURN_CURVES.map(option=><button key={option.id} type="button" aria-pressed={readableTurnCurve(viewer.turnCurve)===option.id}
        className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-blue-600 aria-pressed:bg-blue-50 aria-pressed:text-blue-900"
        onClick={()=>{setPreviewMode("book");setViewer({turnCurve:option.id});}}>{option.label}</button>)}
    </div>
    <p className="text-xs text-muted-foreground">{TURN_CURVES.find(option=>option.id===readableTurnCurve(viewer.turnCurve))!.description}</p>
    <p className="text-sm font-medium">Motion</p>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Page-turn style">
      {TURN_STYLES.map(option=><button key={option.id} type="button" aria-pressed={style===option.id}
        className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-blue-600 aria-pressed:bg-blue-50 aria-pressed:text-blue-900"
        onClick={()=>{setPreviewMode("book");setViewer({turnStyle:option.id});}}>{option.label}</button>)}
    </div>
    <p className="text-xs text-muted-foreground">{TURN_STYLES.find(option=>option.id===style)!.description} Turn a page in the preview to try it.</p>
    <label className="block space-y-2">
      <span>Turn speed · {speed.toFixed(2).replace(/0$/,"")}×</span>
      <input type="range" aria-label="Page-turn speed" min="50" max="200" step="5" value={Math.round(speed*100)}
        className="w-full accent-blue-600" onChange={event=>{setPreviewMode("book");setViewer({turnSpeed:Number(event.target.value)/100});}} />
      <span className="flex justify-between text-xs text-muted-foreground"><span>Slower</span><span>Faster</span></span>
    </label>
    <button type="button" className="text-xs underline underline-offset-2" onClick={()=>setViewer({turnStyle:"classic",turnSpeed:1,turnCurve:"classic"})}>Reset page turns</button>
    <p className="text-xs text-muted-foreground">Applies to Simple and Studio flipbooks. Reduced-motion preferences are respected.</p>
  </fieldset>;
}
