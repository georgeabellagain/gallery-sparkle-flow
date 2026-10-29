import { useEffect, useState } from "react";
import { Briefcase, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readableGa4Id, readableLeadRecipients } from "@/lib/portfolia/business";
import { isBusiness, MAX_LEAD_RECIPIENTS, patchPortfolio, useDoc, type Portfolio } from "@/lib/portfolia/store";
import { BUSINESS_FEATURES } from "@/lib/portfolia/plans";
import { InfoTip } from "./InfoTip";
import { PanelSection } from "./panel-ui";
import { UpgradeModal } from "./UpgradeModal";

const box = "mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm";

/**
 * Business settings for one portfolio: the owner's own Google Analytics 4 and the team addresses that also get lead
 * alerts. On other plans it shows what Business adds, with the way to upgrade.
 */
export function BusinessSettings({ p, onSaveError }: { p: Portfolio; onSaveError: (message: string | null) => void }) {
  const doc = useDoc();
  const business = isBusiness(doc);
  const [upgrade, setUpgrade] = useState(false);
  const [ga, setGa] = useState(p.ga4Id ?? "");
  const [gaProblem, setGaProblem] = useState("");
  const [email, setEmail] = useState("");
  const [emailProblem, setEmailProblem] = useState("");
  useEffect(() => setGa(p.ga4Id ?? ""), [p.ga4Id]);
  const team = readableLeadRecipients(p.leadRecipients);
  const save = (patch: Partial<Portfolio>) => onSaveError(patchPortfolio(patch) ? null : "Couldn’t save that setting.");
  const commitGa = () => {
    if (!ga.trim()) { setGaProblem(""); save({ ga4Id: undefined }); return; }
    const id = readableGa4Id(ga);
    if (!id) return setGaProblem("A Google Analytics 4 ID looks like G-ABC123XYZ.");
    setGaProblem(""); setGa(id); save({ ga4Id: id });
  };
  const addEmail = () => {
    const next = readableLeadRecipients([...team, email]);
    if (next.length === team.length) return setEmailProblem(team.length >= MAX_LEAD_RECIPIENTS ? `Up to ${MAX_LEAD_RECIPIENTS} addresses.` : "That email address doesn’t look right.");
    setEmailProblem(""); setEmail(""); save({ leadRecipients: next });
  };

  if (!business) {
    return (
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl border border-border p-4">
          <p className="flex items-center gap-2 font-medium"><Briefcase className="size-4" aria-hidden />Business</p>
          <p className="mt-1 text-xs text-muted-foreground">Everything in Personal, for studios, brands and teams publishing more.</p>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs">{BUSINESS_FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <Button size="sm" className="mt-4" onClick={() => setUpgrade(true)}>See Business</Button>
        </div>
        <UpgradeModal open={upgrade} plan="business" onClose={() => setUpgrade(false)} />
      </div>
    );
  }
  return (
    <div className="text-sm">
      <PanelSection title="Google Analytics 4" hint="Your own Google Analytics counts visits and page views on this portfolio, alongside Portfolia's reader insights.">
        <label className="block text-xs">
          <span className="flex items-center gap-1">Measurement ID<InfoTip label="Where to find it">In Google Analytics: Admin, Data streams, choose your web stream, then copy the Measurement ID (it starts with G-).</InfoTip></span>
          <input className={box} value={ga} placeholder="G-ABC123XYZ" spellCheck={false} onChange={(e) => setGa(e.target.value)} onBlur={commitGa} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitGa(); } }} />
        </label>
        {gaProblem && <p role="alert" className="text-xs text-destructive">{gaProblem}</p>}
        <p className="text-[11px] text-muted-foreground">Readers are asked first, as privacy law requires: Google Analytics only starts for readers who agree.</p>
      </PanelSection>
      <PanelSection title="Lead alerts for your team" hint={`Each reply to this portfolio's lead form is also emailed to these addresses (up to ${MAX_LEAD_RECIPIENTS}), as well as to your account.`}>
        {team.length > 0 && (
          <ul className="space-y-1">
            {team.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                <span className="truncate">{t}</span>
                <button type="button" aria-label={`Remove ${t}`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground" onClick={() => save({ leadRecipients: team.filter((x) => x !== t) })}><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        {team.length < MAX_LEAD_RECIPIENTS && (
          <div className="flex gap-2">
            <input className={box + " mt-0"} type="email" value={email} placeholder="colleague@studio.com" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} />
            <Button size="sm" variant="line" onClick={addEmail} disabled={!email.trim()}><Plus className="size-3.5" />Add</Button>
          </div>
        )}
        {emailProblem && <p role="alert" className="text-xs text-destructive">{emailProblem}</p>}
      </PanelSection>
      <PanelSection title="Included with Business">
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>Your logo becomes the browser tab icon on your published portfolios (set it in Branding).</li>
          <li>Room for more: larger PDFs and more portfolios.</li>
          <li>Priority email support at <a className="underline underline-offset-4" href="mailto:hello@portfolia.site?subject=Business%20support">hello@portfolia.site</a>.</li>
        </ul>
      </PanelSection>
    </div>
  );
}
