import { useEffect, useState } from "react";
import { Download, Eye, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LEAD_FIELDS, LEAD_LIMITS, defaultLeadForm, leadsCsv, readableLeadForm, type LeadForm } from "@/lib/portfolia/lead-form";
import { deleteLead, ownerLeads } from "@/lib/portfolia/leads.functions";
import { isPaid, patchPortfolio, useDoc, type Portfolio } from "@/lib/portfolia/store";
import { LeadGate } from "./LeadGate";
import { PanelSection, SwitchRow } from "./panel-ui";

type Lead = Awaited<ReturnType<typeof ownerLeads>>["leads"][number];
const field = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm";
const seg = "flex-1 rounded-full px-2 py-1 text-[11px] transition-colors aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

/**
 * Lead capture, as catalogue and brochure makers offer it: a short form at a chosen page that asks readers for their
 * details before they read on. Set it up, preview it, and see, download or remove the leads it has brought in.
 */
export function LeadSettings({ p, onSaveError }: { p: Portfolio; onSaveError: (message: string | null) => void }) {
  const doc = useDoc();
  const pages = p.pdf?.pages ?? 1;
  const form = readableLeadForm(p.leadForm, pages);
  const on = Boolean(form?.enabled);
  const save = (next: LeadForm | undefined) => onSaveError(patchPortfolio({ leadForm: next }) ? null : "Couldn't save the lead form.");
  const set = (patch: Partial<LeadForm>) => save({ ...(form ?? defaultLeadForm(pages)), ...patch });
  const [preview, setPreview] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const headers = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Sign in and save this portfolio to collect leads.");
    return { Authorization: `Bearer ${data.session.access_token}` };
  };
  useEffect(() => {
    let live = true;
    setMessage("");
    void headers().then((h) => ownerLeads({ data: { code: p.code }, headers: h })).then((r) => { if (live) setLeads(r.leads); })
      .catch((e) => { if (live) { setLeads(null); setMessage(e instanceof Error ? e.message : "Couldn't load your leads."); } });
    return () => { live = false; };
  }, [p.code, attempt]);
  const download = () => {
    if (!leads?.length) return;
    const url = URL.createObjectURL(new Blob([leadsCsv(leads)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${(p.name || p.code).replace(/[^\w-]+/g, "-")}-leads.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const remove = async (id: string) => {
    try {
      await deleteLead({ data: { code: p.code, id }, headers: await headers() });
      setLeads((all) => all?.filter((l) => l.id !== id) ?? null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't remove that lead.");
    }
  };
  return (
    <div className="text-sm">
      <PanelSection title="Lead form" hint="When readers reach a page you choose, a short form asks for their email (and anything else you pick) before they read on. You get an email for each one.">
        <SwitchRow label={<span className="flex items-center gap-2">Ask readers for their details{!isPaid(doc) && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Personal</span>}</span>}
          hint={isPaid(doc) ? undefined : "You can set it up now; it takes replies once you have Personal."}>
          <input type="checkbox" checked={on} onChange={(e) => (e.target.checked ? save({ ...(form ?? defaultLeadForm(pages)), enabled: true }) : form && save({ ...form, enabled: false }))} />
        </SwitchRow>
      </PanelSection>
      {form && on && <>
        <PanelSection title="When it appears">
          <label className="flex items-center justify-between gap-3 text-xs">At page
            <input type="number" min={1} max={pages} value={form.page} className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
              onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= pages) set({ page: n }); }} />
          </label>
          <p className="text-[11px] text-muted-foreground">Pages 1{form.page > 2 ? `–${form.page - 1}` : ""} {form.page > 1 ? "stay free to read." : ""}{form.page === 1 ? "The form shows as soon as the portfolio opens." : ""}</p>
          <SwitchRow label="Let readers skip it" hint="A “Not now” link lets them read on without leaving details.">
            <input type="checkbox" checked={form.skippable} onChange={(e) => set({ skippable: e.target.checked })} />
          </SwitchRow>
        </PanelSection>
        <PanelSection title="What it asks">
          <p className="text-xs">Email <span className="text-muted-foreground">· always asked</span></p>
          {LEAD_FIELDS.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3">
              <span className="text-xs">{f.label}</span>
              <div className="flex w-44 gap-0.5 rounded-full bg-muted p-0.5" role="radiogroup" aria-label={f.label}>
                {(["off", "optional", "required"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={(form.fields[f.id] ?? "off") === v} className={seg}
                    onClick={() => { const fields = { ...form.fields }; if (v === "off") delete fields[f.id]; else fields[f.id] = v; set({ fields }); }}>
                    {v === "off" ? "Off" : v === "optional" ? "Optional" : "Required"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </PanelSection>
        <PanelSection title="Words" aside={<Button size="xs" variant="line" onClick={() => setPreview(true)}><Eye className="size-3.5" />Preview</Button>}>
          <label className="block text-xs">Heading<input className={field} maxLength={LEAD_LIMITS.title} value={form.title} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="block text-xs">Message<textarea className={field} rows={2} maxLength={LEAD_LIMITS.message} value={form.message ?? ""} onChange={(e) => set({ message: e.target.value || undefined })} /></label>
          <label className="block text-xs">Button<input className={field} maxLength={LEAD_LIMITS.button} value={form.button ?? ""} placeholder="Continue reading" onChange={(e) => set({ button: e.target.value || undefined })} /></label>
          <label className="block text-xs">Privacy note (optional)<input className={field} maxLength={LEAD_LIMITS.privacy} value={form.privacy ?? ""} placeholder="We'll only use your details to reply to you." onChange={(e) => set({ privacy: e.target.value || undefined })} /></label>
        </PanelSection>
      </>}
      <PanelSection title={`Leads${leads ? ` · ${leads.length}` : ""}`}
        aside={<div className="flex gap-1">
          <Button size="xs" variant="quiet" aria-label="Refresh leads" onClick={() => setAttempt((n) => n + 1)}><RefreshCw className="size-3.5" /></Button>
          <Button size="xs" variant="line" disabled={!leads?.length} onClick={download}><Download className="size-3.5" />CSV</Button>
        </div>}>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        {leads && !leads.length && <p className="text-xs text-muted-foreground">No leads yet. They appear here as readers fill in your form on the published portfolio.</p>}
        {leads && leads.length > 0 && (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
            {leads.slice(0, 200).map((l) => (
              <li key={l.id} className="flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{l.name || l.email}</p>
                  {l.name && <p className="truncate text-[11px] text-muted-foreground">{l.email}</p>}
                  {(l.phone || l.company) && <p className="truncate text-[11px] text-muted-foreground">{[l.company, l.phone].filter(Boolean).join(" · ")}</p>}
                  {l.message && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{l.message}</p>}
                  <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}{l.page ? ` · page ${l.page}` : ""}</p>
                </div>
                <button type="button" aria-label={`Remove lead ${l.email}`} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => void remove(l.id)}><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
      {preview && form && <LeadGate form={{ ...form, enabled: true }} code={p.code} page={form.page} preview onClose={() => setPreview(false)} />}
    </div>
  );
}
