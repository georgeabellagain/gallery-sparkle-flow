import { Plus, Trash2 } from "lucide-react";
import { Section, ColorField, NumberField, SelectField, TextField, ToggleRow } from "./controls";
import { findElement, findItem, patchElement, patchItem, useEditor } from "./editorContext";
import { Button } from "@/components/ui/button";
import { trashElement, updateProject } from "@/lib/portfolia/store";
import { uid } from "@/lib/portfolia/assets";
import { FONT_CHOICES, type ImageDetails } from "@/lib/portfolia/types";

export function InspectorItem() {
  const { portfolio, project, projectId, selection, advanced } = useEditor();
  const item = findItem(project, selection.itemId);
  const element = findElement(item, selection.elementId);

  if (!item) {
    return (
      <Section title="Nothing selected" hint="Pick an item in the content list, or click something on the canvas.">
        <p className="text-xs text-muted-foreground">
          Text can be edited directly on the canvas — click it and type.
        </p>
      </Section>
    );
  }

  /* ----------------------------------------------------------- element ---- */
  if (element) {
    const ep = (fn: Parameters<typeof patchElement>[4], history = true) =>
      patchElement(portfolio.id, projectId, item.id, element.id, fn, history);
    return (
      <>
        <Section title={element.kind === "text" ? "Text element" : "Image element"}>
          {element.kind === "text" ? (
            <TextField
              label="Text"
              area
              value={element.text ?? ""}
              onChange={(v) => ep((el) => void (el.text = v))}
            />
          ) : (
            <TextField
              label="Accessibility description (not shown as a caption)"
              area
              value={element.alt ?? ""}
              onChange={(v) => ep((el) => void (el.alt = v))}
            />
          )}
          <ToggleRow
            label="Locked"
            checked={Boolean(element.locked)}
            onChange={(v) => ep((el) => void (el.locked = v))}
          />
          <ToggleRow
            label="Hidden"
            checked={Boolean(element.hidden)}
            onChange={(v) => ep((el) => void (el.hidden = v))}
          />
          <NumberField
            label="Opacity"
            value={element.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => ep((el) => void (el.opacity = v), false)}
          />
        </Section>

        {advanced && (
          <Section title="Position and size" hint="Percentages of the page, so the page scales as one piece.">
            <NumberField label="X" value={element.x} min={-20} max={100} suffix="%" onChange={(v) => ep((el) => void (el.x = v), false)} />
            <NumberField label="Y" value={element.y} min={-20} max={100} suffix="%" onChange={(v) => ep((el) => void (el.y = v), false)} />
            <NumberField label="Width" value={element.w} min={2} max={140} suffix="%" onChange={(v) => ep((el) => void (el.w = v), false)} />
            <NumberField label="Height" value={element.h} min={2} max={140} suffix="%" onChange={(v) => ep((el) => void (el.h = v), false)} />
            <NumberField
              label="Rotation"
              value={element.rotation}
              min={-180}
              max={180}
              suffix="°"
              onChange={(v) => ep((el) => void (el.rotation = v), false)}
            />
            <NumberField
              label="Stacking order"
              value={element.z}
              min={0}
              max={30}
              onChange={(v) => ep((el) => void (el.z = Math.round(v)))}
            />
          </Section>
        )}

        {element.kind === "image" && advanced && (
          <Section title="Crop and focal point" hint="Cropping is non-destructive; your original file is untouched.">
            <NumberField
              label="Crop left"
              value={(element.crop?.x ?? 0) * 100}
              max={80}
              onChange={(v) =>
                ep((el) => {
                  el.crop = { x: v / 100, y: el.crop?.y ?? 0, w: el.crop?.w ?? 1, h: el.crop?.h ?? 1 };
                }, false)
              }
            />
            <NumberField
              label="Crop top"
              value={(element.crop?.y ?? 0) * 100}
              max={80}
              onChange={(v) =>
                ep((el) => {
                  el.crop = { x: el.crop?.x ?? 0, y: v / 100, w: el.crop?.w ?? 1, h: el.crop?.h ?? 1 };
                }, false)
              }
            />
            <NumberField
              label="Crop width"
              value={(element.crop?.w ?? 1) * 100}
              min={10}
              max={100}
              onChange={(v) =>
                ep((el) => {
                  el.crop = { x: el.crop?.x ?? 0, y: el.crop?.y ?? 0, w: v / 100, h: el.crop?.h ?? 1 };
                }, false)
              }
            />
            <NumberField
              label="Crop height"
              value={(element.crop?.h ?? 1) * 100}
              min={10}
              max={100}
              onChange={(v) =>
                ep((el) => {
                  el.crop = { x: el.crop?.x ?? 0, y: el.crop?.y ?? 0, w: el.crop?.w ?? 1, h: v / 100 };
                }, false)
              }
            />
            <NumberField
              label="Focal point X"
              value={element.focal?.x ?? 50}
              onChange={(v) => ep((el) => void (el.focal = { x: v, y: el.focal?.y ?? 50 }), false)}
            />
            <NumberField
              label="Focal point Y"
              value={element.focal?.y ?? 50}
              onChange={(v) => ep((el) => void (el.focal = { x: el.focal?.x ?? 50, y: v }), false)}
            />
          </Section>
        )}

        {element.kind === "text" && (
          <Section title="Typography">
            <SelectField
              label="Font"
              value={element.style?.font ?? portfolio.theme.bodyFont}
              options={FONT_CHOICES.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(v) => ep((el) => void (el.style = { ...el.style, font: v }))}
            />
            <NumberField
              label="Size"
              value={element.style?.size ?? 16}
              min={8}
              max={96}
              suffix="px"
              onChange={(v) => ep((el) => void (el.style = { ...el.style, size: v }), false)}
            />
            {advanced && (
              <>
                <NumberField
                  label="Weight"
                  value={element.style?.weight ?? 400}
                  min={200}
                  max={800}
                  step={100}
                  onChange={(v) => ep((el) => void (el.style = { ...el.style, weight: v }))}
                />
                <NumberField
                  label="Line height"
                  value={element.style?.lineHeight ?? 1.4}
                  min={0.9}
                  max={2.4}
                  step={0.05}
                  onChange={(v) => ep((el) => void (el.style = { ...el.style, lineHeight: v }), false)}
                />
                <NumberField
                  label="Letter spacing"
                  value={element.style?.letterSpacing ?? 0}
                  min={-0.05}
                  max={0.4}
                  step={0.005}
                  suffix="em"
                  onChange={(v) => ep((el) => void (el.style = { ...el.style, letterSpacing: v }), false)}
                />
              </>
            )}
            <SelectField
              label="Alignment"
              value={element.style?.align ?? "left"}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Centre" },
                { value: "right", label: "Right" },
              ]}
              onChange={(v) => ep((el) => void (el.style = { ...el.style, align: v as "left" }))}
            />
            <ColorField
              label="Colour"
              value={element.style?.color ?? portfolio.theme.text}
              onChange={(v) => ep((el) => void (el.style = { ...el.style, color: v }), false)}
            />
          </Section>
        )}

        {element.kind === "image" && (
          <ImageDetailsEditor
            details={element.details ?? {}}
            onChange={(d) => ep((el) => void (el.details = d), false)}
          />
        )}

        <Section title="Remove">
          <Button
            variant="line"
            size="xs"
            onClick={() => trashElement(portfolio.id, projectId, item.id, element.id)}
          >
            <Trash2 /> Move element to trash
          </Button>
        </Section>
      </>
    );
  }

  /* -------------------------------------------------------------- item ---- */
  const ip = (fn: Parameters<typeof patchItem>[3], history = true) =>
    patchItem(portfolio.id, projectId, item.id, fn, history);

  return (
    <>
      <Section
        title={
          item.kind === "image"
            ? "Image"
            : item.kind === "text"
              ? "Text"
              : item.kind === "pdfPage"
                ? "Imported PDF page"
                : "Designed page"
        }
        hint={
          item.kind === "pdfPage"
            ? "The page is kept exactly as designed. Text and vector artwork inside it are not converted into editable objects — add overlays or crop a region instead."
            : undefined
        }
      >
        {item.kind === "text" && (
          <TextField
            label="Text"
            area
            value={item.text}
            onChange={(v) => ip((i) => void (i.kind === "text" && (i.text = v)), false)}
          />
        )}
        {item.kind === "image" && (
          <TextField
            label="Accessibility description (not shown as a caption)"
            area
            value={item.alt ?? ""}
            onChange={(v) => ip((i) => void (i.kind === "image" && (i.alt = v)), false)}
          />
        )}
        {(item.kind === "pdfPage" || item.kind === "composition") && (
          <TextField
            label="Page label (editor only)"
            value={item.label ?? ""}
            onChange={(v) => ip((i) => void ((i.kind === "pdfPage" || i.kind === "composition") && (i.label = v)))}
          />
        )}
        <ToggleRow label="Hidden" checked={Boolean(item.hidden)} onChange={(v) => ip((i) => void (i.hidden = v))} />
        <ToggleRow label="Locked" checked={Boolean(item.locked)} onChange={(v) => ip((i) => void (i.locked = v))} />
        {advanced && (
          <NumberField
            label="Opacity"
            value={item.opacity ?? 1}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => ip((i) => void (i.opacity = v), false)}
          />
        )}
        {item.kind === "composition" && advanced && (
          <ColorField
            label="Page background"
            value={item.background ?? "#ffffff"}
            onChange={(v) => ip((i) => void (i.kind === "composition" && (i.background = v)), false)}
          />
        )}
        {item.kind === "image" && (
          <Button
            variant="line"
            size="xs"
            onClick={() =>
              updateProject(portfolio.id, projectId, (pr) => {
                if (item.kind === "image") pr.coverAssetId = item.assetId;
              })
            }
          >
            Use as project cover
          </Button>
        )}
      </Section>

      {item.kind === "image" && advanced && (
        <Section title="Crop and focal point" hint="Non-destructive. The uploaded original is never modified.">
          <NumberField
            label="Crop left"
            value={(item.crop?.x ?? 0) * 100}
            max={80}
            onChange={(v) =>
              ip((i) => {
                if (i.kind !== "image") return;
                i.crop = { x: v / 100, y: i.crop?.y ?? 0, w: i.crop?.w ?? 1, h: i.crop?.h ?? 1 };
              }, false)
            }
          />
          <NumberField
            label="Crop top"
            value={(item.crop?.y ?? 0) * 100}
            max={80}
            onChange={(v) =>
              ip((i) => {
                if (i.kind !== "image") return;
                i.crop = { x: i.crop?.x ?? 0, y: v / 100, w: i.crop?.w ?? 1, h: i.crop?.h ?? 1 };
              }, false)
            }
          />
          <NumberField
            label="Crop width"
            value={(item.crop?.w ?? 1) * 100}
            min={10}
            max={100}
            onChange={(v) =>
              ip((i) => {
                if (i.kind !== "image") return;
                i.crop = { x: i.crop?.x ?? 0, y: i.crop?.y ?? 0, w: v / 100, h: i.crop?.h ?? 1 };
              }, false)
            }
          />
          <NumberField
            label="Crop height"
            value={(item.crop?.h ?? 1) * 100}
            min={10}
            max={100}
            onChange={(v) =>
              ip((i) => {
                if (i.kind !== "image") return;
                i.crop = { x: i.crop?.x ?? 0, y: i.crop?.y ?? 0, w: i.crop?.w ?? 1, h: v / 100 };
              }, false)
            }
          />
          <Button
            variant="quiet"
            size="xs"
            onClick={() => ip((i) => void (i.kind === "image" && (i.crop = undefined)))}
          >
            Reset crop
          </Button>
        </Section>
      )}

      {item.kind === "text" && (
        <Section title="Typography">
          <SelectField
            label="Font"
            value={item.style?.font ?? portfolio.theme.bodyFont}
            options={FONT_CHOICES.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(v) => ip((i) => void (i.kind === "text" && (i.style = { ...i.style, font: v })))}
          />
          <NumberField
            label="Size"
            value={item.style?.size ?? 16}
            min={9}
            max={96}
            suffix="px"
            onChange={(v) => ip((i) => void (i.kind === "text" && (i.style = { ...i.style, size: v })), false)}
          />
          <SelectField
            label="Alignment"
            value={item.style?.align ?? "left"}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Centre" },
              { value: "right", label: "Right" },
            ]}
            onChange={(v) =>
              ip((i) => void (i.kind === "text" && (i.style = { ...i.style, align: v as "left" })))
            }
          />
          {advanced && (
            <>
              <NumberField
                label="Weight"
                value={item.style?.weight ?? 400}
                min={200}
                max={800}
                step={100}
                onChange={(v) => ip((i) => void (i.kind === "text" && (i.style = { ...i.style, weight: v })))}
              />
              <NumberField
                label="Line height"
                value={item.style?.lineHeight ?? 1.6}
                min={0.9}
                max={2.4}
                step={0.05}
                onChange={(v) =>
                  ip((i) => void (i.kind === "text" && (i.style = { ...i.style, lineHeight: v })), false)
                }
              />
              <ColorField
                label="Colour"
                value={item.style?.color ?? portfolio.theme.text}
                onChange={(v) => ip((i) => void (i.kind === "text" && (i.style = { ...i.style, color: v })), false)}
              />
            </>
          )}
        </Section>
      )}

      {item.kind === "image" && (
        <ImageDetailsEditor
          details={item.details ?? {}}
          onChange={(d) => ip((i) => void (i.kind === "image" && (i.details = d)), false)}
        />
      )}
    </>
  );
}

/** Optional details shown in the single-image viewer. Empty means no panel. */
export function ImageDetailsEditor({
  details,
  onChange,
}: {
  details: ImageDetails;
  onChange: (d: ImageDetails) => void;
}) {
  const set = (patch: Partial<ImageDetails>) => onChange({ ...details, ...patch });
  return (
    <Section
      title="Image details"
      hint="Only the fields you fill in appear in the image viewer. Leave them all empty and visitors see the image and zoom controls alone."
    >
      <TextField label="Title" value={details.title ?? ""} onChange={(v) => set({ title: v })} />
      <TextField label="Description" area value={details.description ?? ""} onChange={(v) => set({ description: v })} />
      <TextField label="Date" value={details.date ?? ""} onChange={(v) => set({ date: v })} />
      <TextField label="Medium or materials" value={details.medium ?? ""} onChange={(v) => set({ medium: v })} />
      <TextField label="Dimensions" value={details.dimensions ?? ""} onChange={(v) => set({ dimensions: v })} />
      <TextField label="Credits" value={details.credits ?? ""} onChange={(v) => set({ credits: v })} />

      <div className="space-y-2 rule-t pt-3">
        <p className="text-xxs text-muted-foreground">Custom fields</p>
        {(details.custom ?? []).map((c, idx) => (
          <div key={c.id} className="flex gap-1.5">
            <input
              value={c.label}
              placeholder="Label"
              onChange={(e) => {
                const custom = [...(details.custom ?? [])];
                custom[idx] = { ...c, label: e.target.value };
                set({ custom });
              }}
              className="h-8 w-1/3 border border-input bg-background px-2 text-xs"
            />
            <input
              value={c.value}
              placeholder="Value"
              onChange={(e) => {
                const custom = [...(details.custom ?? [])];
                custom[idx] = { ...c, value: e.target.value };
                set({ custom });
              }}
              className="h-8 flex-1 border border-input bg-background px-2 text-xs"
            />
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label="Remove field"
              onClick={() => set({ custom: (details.custom ?? []).filter((x) => x.id !== c.id) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="quiet"
          size="xs"
          onClick={() => set({ custom: [...(details.custom ?? []), { id: uid("cf"), label: "", value: "" }] })}
        >
          <Plus /> Add field
        </Button>
      </div>

      <div className="space-y-2 rule-t pt-3">
        <p className="text-xxs text-muted-foreground">External links — for example “Buy this print”</p>
        {(details.links ?? []).map((l, idx) => (
          <div key={l.id} className="flex gap-1.5">
            <input
              value={l.label}
              placeholder="Label"
              onChange={(e) => {
                const links = [...(details.links ?? [])];
                links[idx] = { ...l, label: e.target.value };
                set({ links });
              }}
              className="h-8 w-1/3 border border-input bg-background px-2 text-xs"
            />
            <input
              value={l.url}
              placeholder="https://"
              onChange={(e) => {
                const links = [...(details.links ?? [])];
                links[idx] = { ...l, url: e.target.value };
                set({ links });
              }}
              className="h-8 flex-1 border border-input bg-background px-2 font-mono text-xxs"
            />
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label="Remove link"
              onClick={() => set({ links: (details.links ?? []).filter((x) => x.id !== l.id) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="quiet"
          size="xs"
          onClick={() => set({ links: [...(details.links ?? []), { id: uid("lk"), label: "", url: "" }] })}
        >
          <Plus /> Add link
        </Button>
      </div>
    </Section>
  );
}
