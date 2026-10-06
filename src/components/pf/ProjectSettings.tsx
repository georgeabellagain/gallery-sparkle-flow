import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uid } from "@/lib/portfolia/assets";
import { getDoc, patchPortfolio, type Portfolio } from "@/lib/portfolia/store";
import { useSyncStatus } from "@/lib/portfolia/cloud";
import { MAX_PROJECTS, PROJECT_TITLE_LIMIT, projectPath, readableProjects, validateProjects, type PortfolioProject } from "@/lib/portfolia/projects";

/** Parent keys this form by PDF so a replacement starts with fresh page ranges. */
export function ProjectSettings({ p }: { p: Portfolio }) {
  const pdf = p.pdf!;
  const sync = useSyncStatus();
  const [items, setItems] = useState<PortfolioProject[]>(() => readableProjects(pdf.projects, pdf.pages));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [manualLink, setManualLink] = useState("");
  const change = (next: PortfolioProject[]) => { setItems(next); setDirty(true); setMessage(""); setError(""); setManualLink(""); };
  const save = () => {
    const invalid = validateProjects(items, pdf.pages);
    if (invalid) return setError(invalid);
    const current = getDoc().portfolio;
    if (current?.code !== p.code || current.pdf?.blobKey !== pdf.blobKey) return setError("The portfolio changed. Reload the editor before saving projects.");
    const projects = readableProjects(items, pdf.pages);
    if (!patchPortfolio({ pdf: { ...current.pdf, projects } })) return setError("Couldn’t save projects. Free some browser storage and try again.");
    setItems(projects); setDirty(false); setError(""); setMessage("Project navigation saved. Account saving status appears at the top of the editor.");
  };
  const copy = async (id: string) => {
    const url = window.location.origin + projectPath(p.code, id);
    try { await navigator.clipboard.writeText(url); setMessage("Project link copied."); setManualLink(""); }
    catch { setManualLink(url); setMessage("Select and copy the project link below."); }
  };
  return <section aria-labelledby="project-settings-title" className="mt-6 rule-t pt-5">
    <h2 id="project-settings-title" className="text-sm font-medium">Named projects</h2>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Give each project a name and page range. Visitors can browse visual contents and open a project directly. Count the cover as page 1.</p>
    <p className="mt-2 text-xs text-muted-foreground">All pages remain available. Replacing the PDF clears its project ranges.</p>
    <div className="mt-4 space-y-4">
      {items.map((item, index) => {
        const edit = (patch: Partial<PortfolioProject>) => change(items.map((p) => p.id === item.id ? { ...p, ...patch } : p));
        return <fieldset key={item.id} className="rounded-xl border border-border p-3">
          <legend className="px-1 text-xs text-muted-foreground">Project {index + 1}</legend>
          <label className="block text-xs">Project name
            <input value={item.title} maxLength={PROJECT_TITLE_LIMIT} onChange={(e) => edit({ title: e.target.value })} placeholder="e.g. Graduate collection" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs">First page<input type="number" min={1} max={pdf.pages} step={1} value={Number.isNaN(item.startPage) ? "" : item.startPage} onChange={(e) => edit({ startPage: e.target.valueAsNumber })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
            <label className="text-xs">Last page<input type="number" min={1} max={pdf.pages} step={1} value={Number.isNaN(item.endPage) ? "" : item.endPage} onChange={(e) => edit({ endPage: e.target.valueAsNumber })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="quiet" disabled={dirty || p.status !== "published" || sync.status === "saving" || sync.status === "error"} onClick={() => void copy(item.id)}><Copy className="size-3.5" /> Copy project link</Button>
            <Button size="sm" variant="quiet" aria-label={`Remove ${item.title || `project ${index + 1}`}`} onClick={() => change(items.filter((p) => p.id !== item.id))}><Trash2 className="size-3.5" /> Remove</Button>
          </div>
        </fieldset>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button size="sm" variant="line" disabled={items.length >= MAX_PROJECTS} onClick={() => { const start = Math.min(pdf.pages, Math.max(0, ...items.map((p) => Number.isFinite(p.endPage) ? p.endPage : 0)) + 1); change([...items, { id: uid("project"), title: "", startPage: start, endPage: start }]); }}><Plus className="size-3.5" /> Add project</Button>
      <Button size="sm" disabled={!dirty} onClick={save}>Save projects</Button>
    </div>
    {dirty && <p className="mt-2 text-xs text-muted-foreground">Save projects to update the preview and enable project links.</p>}
    {p.status !== "published" && items.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Publish your portfolio before sharing project links.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>
    {manualLink && <input aria-label="Project link" readOnly value={manualLink} onFocus={(e) => e.target.select()} className="mt-2 w-full rounded border p-2 text-xs" />}
  </section>;
}
