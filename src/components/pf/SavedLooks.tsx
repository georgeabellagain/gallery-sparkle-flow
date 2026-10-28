import { useEffect, useState } from "react";
import { allPortfolios, DEFAULT_VIEWER, patchPortfolio, patchPortfolioAppearance, useDoc, type Portfolio } from "@/lib/portfolia/store";
import { applyLook, captureLook, MAX_SAVED_LOOKS, type SavedLook } from "@/lib/portfolia/saved-looks";
import { pinPreviewLook, setPreviewMode } from "@/lib/portfolia/preview-look";
import { uid } from "@/lib/portfolia/assets";
import { Button } from "@/components/ui/button";
const title = (p: Portfolio) => p.name || p.pdf?.name || p.profile.name || "Portfolio";
function SavedLookCard({ look, portfolioName, editable, onApply, onRename, onRemove }: { look: SavedLook; portfolioName: string; editable: boolean; onApply: () => void; onRename: (name: string) => void; onRemove: () => void }) {
  const [name, setName] = useState(look.name);
  useEffect(() => setName(look.name), [look.name]);
  const rename = () => { const next = name.trim(); if (!next) { setName(look.name); return; } if (next !== look.name) onRename(next); };
  return <li className="rounded-lg border border-border p-2">
    <div className="flex items-center justify-between gap-2"><div className="min-w-0 flex-1">
      {editable ? <input aria-label={`Name for saved look ${look.name}`} maxLength={60} value={name} onChange={event => setName(event.target.value)} onBlur={rename} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); rename(); } }} className="w-full rounded border border-border bg-background px-1.5 py-1" /> : <span className="break-words">{look.name}</span>}
      <span className="block text-[10px] text-muted-foreground">{portfolioName}</span>
    </div><Button size="xs" variant="line" onClick={onApply}>Apply</Button></div>
    {editable && <div className="mt-1 flex justify-end"><button type="button" className="text-muted-foreground underline" aria-label={`Remove saved look ${look.name}`} onClick={onRemove}>Remove</button></div>}
  </li>;
}

export function SavedLooks({ p, onError }: { p: Portfolio; onError: (message: string | null) => void }) {
  const doc = useDoc(), portfolios = allPortfolios(doc);
  useEffect(() => () => setPreviewMode(null), []);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [notice, setNotice] = useState("");
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const own = p.savedLooks ?? [];
  const report = (ok: boolean, success: string) => { onError(ok ? null : "Couldn’t update that look. Please try again."); setNotice(ok ? success : ""); return ok; };
  const apply = (look: SavedLook) => {
    if (report(patchPortfolioAppearance(p.code, { viewer: applyLook(look, viewer) }), `Applied ${look.name}. Save keeps this appearance.`)) {
      setPreviewMode("book"); pinPreviewLook(look.viewer.look ?? viewer.look);
    }
  };
  const save = () => {
    if (!name.trim()) return onError("Give your look a name.");
    if (own.length >= MAX_SAVED_LOOKS) return onError(`Keep up to ${MAX_SAVED_LOOKS} looks in each portfolio.`);
    const look: SavedLook = { id: uid("look"), name: name.trim().slice(0, 60), viewer: captureLook(viewer) };
    if (report(patchPortfolio({ savedLooks: [...own, look] }), "Look added to your draft. Save the portfolio to keep it.")) setName("");
  };
  const available = portfolios.flatMap(portfolio => (portfolio.savedLooks ?? []).map(look => ({ portfolio, look })));
  return <details className="mt-3 rounded-2xl border border-border/80 px-3 py-2.5">
    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Your looks & copy appearance</summary>
    <div className="mt-3 space-y-3 text-xs">
      <p className="text-muted-foreground">Keep lighting, paper, motion and backgrounds—including uploaded pictures. PDF content, branding and sharing settings stay with each portfolio. Personal options still need Personal to save.</p>
      <label className="block">Name this look<input maxLength={60} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } }} className="mt-1 w-full rounded-lg border bg-background px-2.5 py-2" /></label>
      <Button size="xs" variant="line" disabled={own.length >= MAX_SAVED_LOOKS} onClick={save}>Save current look</Button>
      {available.length > 0 && <ul className="space-y-2" aria-label="Saved looks">{available.map(({ portfolio, look }) => <SavedLookCard key={`${portfolio.code}:${look.id}`} look={look} portfolioName={title(portfolio)} editable={portfolio.code === p.code} onApply={() => apply(look)}
        onRename={next => report(patchPortfolio({ savedLooks: own.map(item => item.id === look.id ? { ...item, name: next } : item) }), "Look renamed in your draft.")}
        onRemove={() => report(patchPortfolio({ savedLooks: own.filter(item => item.id !== look.id) }), "Look removed from your draft. Discard restores it until you save.")} />)}</ul>}
      {portfolios.some(item => item.code !== p.code) && <div className="space-y-2 border-t border-border pt-3">
        <label className="block">Copy appearance from<select value={source} onChange={e => setSource(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="">Choose a portfolio</option>{portfolios.filter(item => item.code !== p.code).map(item => <option key={item.code} value={item.code}>{title(item)}</option>)}</select></label>
        <Button size="xs" variant="line" disabled={!source} onClick={() => { const from = portfolios.find(item => item.code === source); if (from) apply({ id: "copy", name: title(from), viewer: captureLook({ ...DEFAULT_VIEWER, ...from.viewer }) }); }}>Copy to this portfolio</Button>
      </div>}
      {notice && <p role="status" className="text-muted-foreground">{notice}</p>}
      <p className="text-[10px] text-muted-foreground">Save keeps these changes and syncs them when signed in. Discard restores your previous version.</p>
    </div>
  </details>;
}
