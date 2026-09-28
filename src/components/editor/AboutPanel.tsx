import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Section, TextField, ToggleRow } from "./controls";
import { Button } from "@/components/ui/button";
import { AssetImage } from "@/components/portfolia/AssetImage";
import { useEditor } from "./editorContext";
import { updatePortfolio } from "@/lib/portfolia/store";
import { uploadFileAsset } from "@/lib/portfolia/uploads";
import { uid } from "@/lib/portfolia/assets";

export function AboutPanel() {
  const { portfolio, notify } = useEditor();
  const about = portfolio.about;
  const portraitRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);
  const up = (fn: (a: typeof about) => void, history = false) =>
    updatePortfolio(portfolio.id, (p) => fn(p.about), { history });

  return (
    <>
      <Section
        title="About page"
        hint="Optional. Only the sections you switch on appear — unused ones are left out entirely, not shown empty."
      >
        <ToggleRow
          label="Include an About page"
          checked={about.enabled}
          onChange={(v) => up((a) => void (a.enabled = v), true)}
        />
      </Section>

      {about.enabled && (
        <>
          <Section title="Who you are">
            <TextField label="Name" value={about.name ?? ""} onChange={(v) => up((a) => void (a.name = v))} />
            <TextField
              label="Discipline"
              value={about.discipline ?? ""}
              onChange={(v) => up((a) => void (a.discipline = v))}
            />
            <ToggleRow label="Show biography" checked={about.show.bio} onChange={(v) => up((a) => void (a.show.bio = v), true)} />
            {about.show.bio && (
              <TextField label="Biography" area value={about.bio ?? ""} onChange={(v) => up((a) => void (a.bio = v))} />
            )}
          </Section>

          <Section title="Portrait">
            <ToggleRow
              label="Show a portrait"
              checked={about.show.portrait}
              onChange={(v) => up((a) => void (a.show.portrait = v), true)}
            />
            {about.show.portrait && (
              <div className="flex items-center gap-3">
                {about.portraitId && (
                  <AssetImage assetId={about.portraitId} alt="" className="h-16 w-16" />
                )}
                <input
                  ref={portraitRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const id = await uploadFileAsset(file);
                      up((a) => void (a.portraitId = id), true);
                    } catch {
                      notify("That portrait could not be saved in this browser.", "error");
                    }
                  }}
                />
                <Button size="xs" variant="line" onClick={() => portraitRef.current?.click()}>
                  {about.portraitId ? "Replace portrait" : "Upload portrait"}
                </Button>
              </div>
            )}
          </Section>

          <Section title="Contact">
            <ToggleRow
              label="Show contact details"
              checked={about.show.contact}
              onChange={(v) => up((a) => void (a.show.contact = v), true)}
            />
            {about.show.contact && (
              <>
                <TextField label="Email" value={about.email ?? ""} onChange={(v) => up((a) => void (a.email = v))} />
                <TextField label="Phone" value={about.phone ?? ""} onChange={(v) => up((a) => void (a.phone = v))} />
                <TextField
                  label="Location"
                  value={about.location ?? ""}
                  onChange={(v) => up((a) => void (a.location = v))}
                />
              </>
            )}
          </Section>

          <Section title="Links">
            <ToggleRow label="Show links" checked={about.show.links} onChange={(v) => up((a) => void (a.show.links = v), true)} />
            {about.show.links && (
              <>
                {(about.links ?? []).map((l, idx) => (
                  <div key={l.id} className="flex gap-1.5">
                    <input
                      value={l.label}
                      placeholder="Label"
                      onChange={(e) => up((a) => void (a.links![idx] = { ...l, label: e.target.value }))}
                      className="h-8 w-1/3 border border-input bg-background px-2 text-xs"
                    />
                    <input
                      value={l.url}
                      placeholder="https://"
                      onChange={(e) => up((a) => void (a.links![idx] = { ...l, url: e.target.value }))}
                      className="h-8 flex-1 border border-input bg-background px-2 font-mono text-xxs"
                    />
                    <Button
                      size="icon-sm"
                      variant="quiet"
                      aria-label="Remove link"
                      onClick={() => up((a) => void (a.links = (a.links ?? []).filter((x) => x.id !== l.id)), true)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  size="xs"
                  variant="quiet"
                  onClick={() => up((a) => void (a.links = [...(a.links ?? []), { id: uid("ln"), label: "", url: "" }]), true)}
                >
                  <Plus /> Add link
                </Button>
              </>
            )}
          </Section>

          <Section title="CV">
            <ToggleRow label="Offer a CV download" checked={about.show.cv} onChange={(v) => up((a) => void (a.show.cv = v), true)} />
            {about.show.cv && (
              <div className="space-y-2">
                {about.cvName && <p className="text-xs text-muted-foreground">{about.cvName}</p>}
                <input
                  ref={cvRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const id = await uploadFileAsset(file);
                      up((a) => {
                        a.cvAssetId = id;
                        a.cvName = file.name;
                      }, true);
                    } catch {
                      notify("That file could not be saved in this browser.", "error");
                    }
                  }}
                />
                <Button size="xs" variant="line" onClick={() => cvRef.current?.click()}>
                  {about.cvAssetId ? "Replace CV (PDF)" : "Upload CV (PDF)"}
                </Button>
              </div>
            )}
          </Section>
        </>
      )}
    </>
  );
}
