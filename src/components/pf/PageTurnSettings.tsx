import { readableHiddenPages } from "@/lib/portfolia/hidden-pages";
import { BOOK_STYLES, readableBookStyle } from "@/lib/portfolia/book-style";
import { TURN_CURVES, readableTurnCurve } from "@/lib/portfolia/turn-curve";
import { useEffect, type CSSProperties } from "react";
import { TAB_STYLES, readableTabStyle, type TabStyle } from "@/lib/portfolia/tab-style";
import { TURN_STYLES, readableTurnSpeed, readableTurnStyle } from "@/lib/portfolia/turn-motion";
import { requestPreviewTurn, cancelPreviewTurn } from "@/lib/portfolia/preview-turn";
import { setPreviewMode } from "@/lib/portfolia/preview-look";
import type { ViewerSettings } from "@/lib/portfolia/store";
import { PanelSection, SliderRow, optionClass } from "./panel-ui";

/** Each tab shape in miniature (the book draws the real ones from tab-style.ts). */
const TAB_PREVIEW: Record<TabStyle, CSSProperties> = {
  rounded: { borderRadius: "0 7px 7px 0" },
  pill: { borderRadius: "0 999px 999px 0" },
  square: { borderRadius: "0 1.5px 1.5px 0" },
  angled: { clipPath: "polygon(0 0, 100% 16%, 100% 84%, 0 100%)" },
  ribbon: { clipPath: "polygon(0 0, 100% 0, 76% 50%, 100% 100%, 0 100%)" },
};

export function PageTurnSettings({viewer,setViewer,pages=0}:{viewer:ViewerSettings;setViewer:(patch:Partial<ViewerSettings>)=>boolean;pages?:number}) {
  useEffect(()=>()=>{ setPreviewMode(null); cancelPreviewTurn(); },[]);
  const style=readableTurnStyle(viewer.turnStyle), speed=readableTurnSpeed(viewer.turnSpeed), book=readableBookStyle(viewer.bookStyle), tabStyle=readableTabStyle(viewer.tabStyle);
  // Every change here shows the flipbook in the preview.
  const change=(patch:Partial<ViewerSettings>)=>{setPreviewMode("book");setViewer(patch);};
  return <div>
    <button type="button" className="mb-4 w-full rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40" disabled={pages - readableHiddenPages(viewer.hiddenPages, pages).length < 2} onClick={requestPreviewTurn}>Test page turn</button>
    <p className="mb-4 text-xs text-muted-foreground">Try the current motion in the preview. Your opening page stays unchanged.</p>
    <PanelSection title="Book type" hint={BOOK_STYLES.find(option=>option.id===book)!.description}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Book style">
        {BOOK_STYLES.map(option=><button key={option.id} type="button" aria-pressed={book===option.id} className={optionClass} onClick={()=>change({bookStyle:option.id})}>{option.label}</button>)}
      </div>
    </PanelSection>
    <PanelSection title="Pages behind the spread" hint="Show individual paper layers beneath the open pages for a fuller 3D booklet. Updates as you turn; works in Simple and Studio.">
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={viewer.pageStack === true} onChange={e => change({pageStack:e.target.checked})} />Show layered pages</label>
      <p className="mt-2 text-xs text-muted-foreground">Shows paper edges, without loading every hidden PDF page.</p>
    </PanelSection>
    <PanelSection title="Page tabs" hint={`${TAB_STYLES.find(option=>option.id===tabStyle)!.description} Add tabs in Scrapbook.`}>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Page tab style">
        {TAB_STYLES.map(option=><button key={option.id} type="button" role="radio" aria-checked={tabStyle===option.id} title={option.description} onClick={()=>change({tabStyle:option.id})}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-1.5 text-[10px] transition-colors hover:bg-muted/60 aria-checked:border-foreground aria-checked:bg-muted">
          {/* A sliver of page with the tab standing out of its edge. */}
          <span aria-hidden className="relative flex h-9 w-full items-center">
            <span className="h-full w-1/2 rounded-sm bg-background shadow-[0_0_0_1px_rgb(0_0_0/0.08)]" />
            <span className="h-5 w-3.5 bg-[#e0795a]" style={TAB_PREVIEW[option.id]} />
          </span>
          <span className="leading-none">{option.label}</span>
        </button>)}
      </div>
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
