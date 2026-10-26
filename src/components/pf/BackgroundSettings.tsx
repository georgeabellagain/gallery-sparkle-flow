import { BackgroundPresetPicker } from "./BackgroundPresetPicker";
import { BackgroundScenePicker } from "./BackgroundScenePicker";
import { BackgroundSceneLayer } from "./BackgroundSceneLayer";
import { PanelSection, SliderRow, SwitchRow } from "./panel-ui";
import { backgroundScene } from "@/lib/portfolia/background-scenes";
import { useEffect, useRef, useState } from "react";
import { useBlob, useObjectUrl } from "./Chrome";
import { Button } from "@/components/ui/button";
import { backgroundPicture } from "@/lib/portfolia/background-presets";
import {
  backgroundFor,
  backgroundKeys,
  type BackgroundChoice,
} from "@/lib/portfolia/background-settings";
import { DEFAULT_FIT } from "@/lib/portfolia/background";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { type ViewerSettings, type BackgroundContext } from "@/lib/portfolia/store";
import { setPreviewLook, setPreviewMode } from "@/lib/portfolia/preview-look";
/** A texture you pick starts at half size (finer grain behind the book); style presets set their own size. */
const TEXTURE_FIT = { ...DEFAULT_FIT, scale: 0.5, tile: true };

const contexts = [
  ["studio", "Flipbook · Studio"],
  ["clean", "Flipbook · Simple"],
  ["scroll", "Scroll"],
  ["paged", "Page by page"],
] as const;
function Picture({
  choice,
  label,
  className = "h-16 w-full object-cover",
}: {
  choice: BackgroundChoice;
  label: string;
  className?: string;
}) {
  const blob = useBlob(choice.backgroundKey),
    uploaded = useObjectUrl(blob);
  const url = backgroundPicture(choice, uploaded);
  const scene = !choice.backgroundKey ? backgroundScene(choice.backgroundPreset) : null;
  if (scene) return <span aria-label={label} className={`${className} relative block overflow-hidden`}><BackgroundSceneLayer scene={scene} /></span>;
  return url ? (
    <img src={url} alt={label} className={className} />
  ) : (
    <span
      aria-label={label}
      className={`${className} block`}
      style={{ background: choice.backgroundColor ?? "#191d3a" }}
    />
  );
}
export function BackgroundSettings({
  viewer,
  setViewer,
  defaultColour,
}: {
  viewer: ViewerSettings;
  setViewer: (patch: Partial<ViewerSettings>) => boolean;
  defaultColour: string;
}) {
  useEffect(() => () => setPreviewMode(null), []);
  const latest = useRef(viewer);
  latest.current = viewer;
  const [target, setTarget] = useState<BackgroundContext | "main">("main");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const choice = target === "main" ? viewer : backgroundFor(viewer, target);
  const fit = { ...DEFAULT_FIT, ...choice.backgroundFit };
  const update = (next: BackgroundChoice) =>
    target === "main"
      ? setViewer(next)
      : setViewer({ backgrounds: { ...viewer.backgrounds, [target]: next } });
  const choose = (next: BackgroundChoice) =>
    update({
      backgroundColor: defaultColour,
      backgroundKey: undefined,
      backgroundPreset: undefined,
      backgroundFit: DEFAULT_FIT,
      ...next,
    });
  const setFit = (patch: Partial<typeof fit>) =>
    update({
      backgroundColor: choice.backgroundColor,
      backgroundKey: choice.backgroundKey,
      backgroundPreset: choice.backgroundPreset,
      backgroundFit: {
        ...fit,
        ...patch,
        tile: Boolean(choice.backgroundPreset && !choice.backgroundKey),
      },
    });
  const uploads = backgroundKeys(viewer);
  const title =
    target === "main" ? "Default background" : contexts.find(([id]) => id === target)![1];
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 15 * 1048576) {
      setError("Choose an image up to 15 MB.");
      return;
    }
    setBusy(true);
    let url = "";
    try {
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
      );
      if (!blob) throw Error();
      const key = uid("bg");
      await putBlob(key, blob);
      const next = {
        backgroundKey: key,
        backgroundPreset: undefined,
        backgroundColor: defaultColour,
        backgroundFit: DEFAULT_FIT,
      };
      if (
        !setViewer({
          backgroundUploads: [...new Set([...backgroundKeys(latest.current), key])],
          ...(target === "main"
            ? next
            : { backgrounds: { ...latest.current.backgrounds, [target]: next } }),
        })
      )
        throw Error();
    } catch {
      setError("The picture could not be saved. Please try again.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  };
  const sceneChosen = !choice.backgroundKey && Boolean(backgroundScene(choice.backgroundPreset));
  return (
    <div>
      <PanelSection
        title="Applies to"
        hint="One background everywhere, or a different one for each view."
        aside={target !== "main" ? (
          <button type="button" className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setViewer({ backgrounds: { ...viewer.backgrounds, [target]: undefined } })}>
            Use default here
          </button>
        ) : undefined}
      >
        <button
          type="button"
          aria-pressed={target === "main"}
          onClick={() => {
            setTarget("main");
            setPreviewMode(null);
          }}
          className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border p-1.5 text-left text-xs aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1"
        >
          <Picture choice={viewer} label="Default background" className="h-10 w-16 shrink-0 rounded-lg object-cover" />
          <span className="font-medium">Default background</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          {contexts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={target === id}
              onClick={() => {
                setTarget(id);
                setPreviewMode(id === "studio" || id === "clean" ? "book" : id);
                setPreviewLook(id === "studio" ? "studio" : "clean");
              }}
              className="overflow-hidden rounded-xl border border-border text-left text-xs aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1"
            >
              <Picture choice={backgroundFor(viewer, id)} label={label} className="h-12 w-full object-cover" />
              <span className="block px-2 py-1.5">{label}</span>
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Colour & motion" hint="Minimal fields of colour; the moving ones drift slowly behind the book. Sorbet and Aurora are included on Free.">
        <BackgroundScenePicker selected={!choice.backgroundKey ? choice.backgroundPreset : undefined} onSelect={(id, base) => choose({ backgroundPreset: id, backgroundColor: base })} />
      </PanelSection>
      <PanelSection title="Surfaces" hint="Photographed textures. Warm wood and Soft concrete are included on Free; the others and uploads need Personal to save.">
        <BackgroundPresetPicker selected={!choice.backgroundKey?choice.backgroundPreset:undefined} onSelect={id=>choose({backgroundPreset:id,backgroundFit:TEXTURE_FIT})} />
      </PanelSection>
      <PanelSection title="Your own">
        <label className="flex items-center justify-between gap-3 text-xs">
          Colour wheel
          <input
            type="color"
            aria-label={`${title} colour`}
            value={choice.backgroundColor ?? defaultColour}
            onChange={(e) => choose({ backgroundColor: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-transparent"
          />
        </label>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <Button size="xs" variant="line" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Saving picture…" : "Upload picture"}
        </Button>
        {uploads.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {uploads.map((key, i) => (
              <button
                key={key}
                type="button"
                aria-label={`Use uploaded picture ${i + 1}`}
                aria-pressed={choice.backgroundKey === key}
                onClick={() => choose({ backgroundKey: key })}
                className="overflow-hidden rounded-lg border border-border aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1"
              >
                <Picture choice={{ backgroundKey: key }} label={`Uploaded picture ${i + 1}`} className="h-12 w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </PanelSection>
      {(choice.backgroundKey || choice.backgroundPreset) && !sceneChosen && (
        <PanelSection title="Size & position" aside={<button type="button" className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setFit(choice.backgroundPreset && !choice.backgroundKey ? TEXTURE_FIT : DEFAULT_FIT)}>Reset</button>}>
          {(
            [
              [
                "scale",
                "Size",
                choice.backgroundPreset && !choice.backgroundKey ? 25 : 100,
                300,
                5,
              ],
              ["x", "Left / right", -100, 100, 2],
              ["y", "Up / down", -100, 100, 2],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <SliderRow key={key} label={label} value={key === "scale" ? `${Math.round(fit.scale * 100)}%` : undefined}>
              <input
                type="range"
                className="w-full"
                aria-label={`${title} ${label}`}
                min={min}
                max={max}
                step={step}
                value={Math.round(fit[key] * 100)}
                disabled={key !== "scale" && fit.scale <= 1}
                onChange={(e) => setFit({ [key]: Number(e.target.value) / 100 })}
              />
            </SliderRow>
          ))}
        </PanelSection>
      )}
      <PanelSection title="Studio lighting">
        <SwitchRow label="Light background with HDRI" hint={sceneChosen ? "On: the book casts its Studio shadow on the colour scene. Off: no shadow behind the book." : "The Studio light falls on the background too."}>
          <input
            type="checkbox"
            checked={viewer.backgroundLighting ?? true}
            onChange={(e) => {
              setViewer({ backgroundLighting: e.target.checked, background3D: false });
              setPreviewLook("studio");
            }}
          />
        </SwitchRow>
      </PanelSection>
      {error && (
        <p role="alert" className="pt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
