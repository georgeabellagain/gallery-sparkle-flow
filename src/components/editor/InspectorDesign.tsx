import { Section, ColorField, NumberField, SelectField, ToggleRow, TextField } from "./controls";
import { useEditor } from "./editorContext";
import { updatePortfolio, updateProject } from "@/lib/portfolia/store";
import { FONT_CHOICES, LAYOUTS, type LayoutId } from "@/lib/portfolia/types";
import { cn } from "@/lib/utils";

export function InspectorDesign() {
  const { portfolio, project, projectId, advanced } = useEditor();
  const activeLayout = (project.layout ?? null) || portfolio.defaultLayout;
  const settings = portfolio.layoutSettings[activeLayout];
  const theme = portfolio.theme;

  return (
    <>
      <Section
        title="Viewing style"
        hint="Your content is shared across all five styles. Switching keeps everything, and each style remembers its own spacing."
      >
        <div className="space-y-1.5">
          {LAYOUTS.map((l) => {
            const isDefault = portfolio.defaultLayout === l.id;
            const isActive = activeLayout === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  updateProject(portfolio.id, projectId, (pr) => {
                    pr.layout = l.id;
                  })
                }
                className={cn(
                  "w-full border px-3 py-2 text-left transition-colors",
                  isActive ? "border-foreground" : "border-border hover:border-border-strong",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm">{l.name}</span>
                  {isDefault && <span className="text-xxs text-muted-foreground">portfolio default</span>}
                </span>
                <span className="mt-0.5 block text-xxs leading-relaxed text-muted-foreground">
                  {l.blurb}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="text-xxs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() =>
              updatePortfolio(portfolio.id, (p) => {
                p.defaultLayout = activeLayout;
              })
            }
          >
            Make this the portfolio default
          </button>
          {project.layout && (
            <button
              type="button"
              className="text-xxs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() =>
                updateProject(portfolio.id, projectId, (pr) => {
                  pr.layout = null;
                })
              }
            >
              Remove this project’s override
            </button>
          )}
        </div>
      </Section>

      <Section title={`Spacing — ${LAYOUTS.find((l) => l.id === activeLayout)?.name}`}>
        <NumberField
          label="Gap between items"
          value={settings.gap}
          min={0}
          max={160}
          suffix="px"
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.layoutSettings[activeLayout].gap = v;
            })
          }
        />
        {(activeLayout === "grid" || activeLayout === "masonry") && (
          <NumberField
            label="Columns"
            value={settings.columns}
            min={1}
            max={6}
            onChange={(v) =>
              updatePortfolio(portfolio.id, (p) => {
                p.layoutSettings[activeLayout].columns = Math.round(v);
              })
            }
          />
        )}
        <NumberField
          label="Side padding"
          value={settings.padding}
          min={0}
          max={140}
          suffix="px"
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.layoutSettings[activeLayout].padding = v;
            })
          }
        />
        <NumberField
          label="Maximum width"
          value={settings.maxWidth}
          min={600}
          max={1600}
          step={20}
          suffix="px"
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.layoutSettings[activeLayout].maxWidth = v;
            })
          }
        />
        <ToggleRow
          label="Show image titles as captions"
          checked={settings.captions}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.layoutSettings[activeLayout].captions = v;
            })
          }
        />
      </Section>

      <Section title="Type and colour">
        <SelectField
          label="Headings"
          value={theme.headingFont}
          options={FONT_CHOICES.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.theme.headingFont = v;
            })
          }
        />
        <SelectField
          label="Body"
          value={theme.bodyFont}
          options={FONT_CHOICES.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.theme.bodyFont = v;
            })
          }
        />
        <ColorField
          label="Text"
          value={theme.text}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.theme.text = v;
            })
          }
        />
        <ColorField
          label="Background"
          value={theme.background}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.theme.background = v;
            })
          }
        />
        {advanced && (
          <>
            <NumberField
              label="Heading scale"
              value={theme.headingScale}
              min={0.7}
              max={1.8}
              step={0.05}
              suffix="×"
              onChange={(v) =>
                updatePortfolio(portfolio.id, (p) => {
                  p.theme.headingScale = v;
                })
              }
            />
            <NumberField
              label="Body scale"
              value={theme.bodyScale}
              min={0.8}
              max={1.6}
              step={0.05}
              suffix="×"
              onChange={(v) =>
                updatePortfolio(portfolio.id, (p) => {
                  p.theme.bodyScale = v;
                })
              }
            />
            <NumberField
              label="Line height"
              value={theme.lineHeight}
              min={1}
              max={2.2}
              step={0.05}
              onChange={(v) =>
                updatePortfolio(portfolio.id, (p) => {
                  p.theme.lineHeight = v;
                })
              }
            />
            <NumberField
              label="Letter spacing"
              value={theme.letterSpacing}
              min={-0.05}
              max={0.3}
              step={0.005}
              suffix="em"
              onChange={(v) =>
                updatePortfolio(portfolio.id, (p) => {
                  p.theme.letterSpacing = v;
                })
              }
            />
          </>
        )}
      </Section>

      <Section title="Portfolio">
        <TextField
          label="Title"
          value={portfolio.title}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.title = v;
            })
          }
        />
        <TextField
          label="Tagline shown on the cover page"
          value={portfolio.tagline ?? ""}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.tagline = v;
            })
          }
          area
        />
        <SelectField
          label="Discipline (used by Explore)"
          value={portfolio.discipline}
          options={[
            "Architecture",
            "Photography",
            "Graphic design",
            "Fine art",
            "Illustration",
            "Other",
          ].map((d) => ({ value: d, label: d }))}
          onChange={(v) =>
            updatePortfolio(portfolio.id, (p) => {
              p.discipline = v as typeof p.discipline;
            })
          }
        />
      </Section>
    </>
  );
}

export function layoutName(id: LayoutId) {
  return LAYOUTS.find((l) => l.id === id)?.name ?? id;
}
