import { BOOK_STYLES, readableBookStyle } from "@/lib/portfolia/book-style";
import { TURN_CURVES, readableTurnCurve } from "@/lib/portfolia/turn-curve";
import { useEffect } from "react";
import { TURN_STYLES, readableTurnSpeed, readableTurnStyle } from "@/lib/portfolia/turn-motion";
import { setPreviewMode } from "@/lib/portfolia/preview-look";
import type { ViewerSettings } from "@/lib/portfolia/store";
import { RIBBON_COLOURS, readableRibbonColour } from "@/lib/portfolia/book-details";
import { PanelSection, SliderRow, SwitchRow, optionClass } from "./panel-ui";

const RIBBON_NAMES: Record<string, string> = { "#8c1d2c": "Deep red", "#1f3a5f": "Navy", "#2f5d3a": "Forest green", "#c9a227": "Gold", "#1c1c1c": "Black", "#efe9dc": "Ivory" };

export function PageTurnSettings({viewer,setViewer,pages=0}:{viewer:ViewerSettings;setViewer:(patch:Partial<ViewerSettings>)=>boolean;pages?:number}) {
  useEffect(()=>()=>setPreviewMode(null),[]);
  const style=readableTurnStyle(viewer.turnStyle), speed=readableTurnSpeed(viewer.turnSpeed), book=readableBookStyle(viewer.bookStyle);
  // Every change here shows the flipbook in the preview.
  const change=(patch:Partial<ViewerSettings>)=>{setPreviewMode("book");setViewer(patch);};
  return <div>
    <PanelSection title="Book type" hint={BOOK_STYLES.find(option=>option.id===book)!.description}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Book style">
        {BOOK_STYLES.map(option=><button key={option.id} type="button" aria-pressed={book===option.id} className={optionClass} onClick={()=>change({bookStyle:option.id})}>{option.label}</button>)}
      </div>
      {book!=="flipbook" && <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
        <SwitchRow label="Ribbon bookmark">
          <input type="checkbox" role="switch" checked={viewer.ribbon===true} onChange={event=>change({ribbon:event.target.checked})} />
        </SwitchRow>
        {viewer.ribbon===true && pages>1 && <label className="flex items-center justify-between gap-3 text-xs">
          <span>Marks</span>
          <select aria-label="Page the ribbon marks" className="max-w-[11rem] rounded-lg border border-border bg-background px-2 py-1.5 text-xs" value={viewer.ribbonPage ?? ""}
            onChange={event=>change({ribbonPage:event.target.value?Number(event.target.value):undefined})}>
            <option value="">No page (tail only)</option>
            {Array.from({length:pages},(_,i)=><option key={i+1} value={i+1}>{i===0?"Page 1 (cover: marks the first spread)":`Page ${i+1}`}</option>)}
          </select>
        </label>}
        {viewer.ribbon===true && viewer.ribbonPage!==undefined && <p className="text-xs text-muted-foreground">The ribbon lies across that spread when it is open, and shows between the pages everywhere else.</p>}
        {(viewer.ribbon===true||book==="hardback") && <div>
          <p className="text-xs text-muted-foreground">{book==="hardback"?"Ribbon and headband colour":"Ribbon colour"}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Ribbon colour">
            {RIBBON_COLOURS.map(colour=><button key={colour} type="button" role="radio" aria-checked={readableRibbonColour(viewer.ribbonColour)===colour} aria-label={RIBBON_NAMES[colour]} title={RIBBON_NAMES[colour]}
              className="size-6 rounded-full border border-black/15 transition-transform hover:scale-110 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-2" style={{background:colour}}
              onClick={()=>change({ribbonColour:colour})} />)}
          </div>
        </div>}
      </div>}
    </PanelSection>
    <PanelSection title="Page curve" hint={TURN_CURVES.find(option=>option.id===readableTurnCurve(viewer.turnCurve))!.description}>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Page-curve shape">
        {TURN_CURVES.map(option=><button key={option.id} type="button" aria-pressed={readableTurnCurve(viewer.turnCurve)===option.id} className={optionClass} onClick={()=>change({turnCurve:option.id})}>{option.label}</button>)}
      </div>
    </PanelSection>
    <PanelSection title="Motion" hint={`${TURN_STYLES.find(option=>option.id===style)!.description} Turn a page in the preview to try it.`}
      aside={<button type="button" className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={()=>setViewer({turnStyle:"classic",turnSpeed:1,turnCurve:"classic"})}>Reset</button>}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Page-turn style">
        {TURN_STYLES.map(option=><button key={option.id} type="button" aria-pressed={style===option.id} className={optionClass} onClick={()=>change({turnStyle:option.id})}>{option.label}</button>)}
      </div>
      <SliderRow label="Speed" value={`${speed.toFixed(2).replace(/0$/,"")}×`}>
        <input type="range" aria-label="Page-turn speed" min="50" max="200" step="5" value={Math.round(speed*100)}
          className="w-full" onChange={event=>change({turnSpeed:Number(event.target.value)/100})} />
      </SliderRow>
      <p className="text-xs text-muted-foreground">Applies to Simple and Studio flipbooks. Reduced-motion preferences are respected.</p>
    </PanelSection>
  </div>;
}
