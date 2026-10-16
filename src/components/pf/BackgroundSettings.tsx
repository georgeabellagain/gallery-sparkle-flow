import { useEffect, useRef, useState } from "react";
import { useBlob, useObjectUrl } from "./Chrome";
import { Button } from "@/components/ui/button";
import { BACKGROUND_PRESETS, backgroundPicture } from "@/lib/portfolia/background-presets";
import {
  backgroundFor,
  backgroundKeys,
  type BackgroundChoice,
} from "@/lib/portfolia/background-settings";
import { DEFAULT_FIT } from "@/lib/portfolia/background";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { type ViewerSettings, type BackgroundContext } from "@/lib/portfolia/store";
import { setPreviewLook, setPreviewMode } from "@/lib/portfolia/preview-look";
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
  return (
    <div className="space-y-3">
      <p className="font-medium">Background</p>
      <button
        type="button"
        aria-pressed={target === "main"}
        onClick={() => {
          setTarget("main");
          setPreviewMode(null);
        }}
        className="w-full overflow-hidden rounded-lg border border-border text-left aria-pressed:ring-2 aria-pressed:ring-blue-600"
      >
        <Picture choice={viewer} label="Default background" />
        <span className="block p-2">Default background</span>
      </button>
      <p>Different backgrounds</p>
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
            className="overflow-hidden rounded-lg border border-border text-left aria-pressed:ring-2 aria-pressed:ring-blue-600"
          >
            <Picture choice={backgroundFor(viewer, id)} label={label} />
            <span className="block p-2">{label}</span>
          </button>
        ))}
      </div>
      <div className="space-y-3 border-t border-border pt-3">
        <p className="font-medium">{title}</p>
        <label className="flex items-center justify-between gap-3">
          Colour wheel
          <input
            type="color"
            aria-label={`${title} colour`}
            value={choice.backgroundColor ?? defaultColour}
            onChange={(e) => choose({ backgroundColor: e.target.value })}
            className="h-10 w-12 cursor-pointer rounded border border-border"
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
        <Button size="xs" variant="line" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Saving picture…" : "Upload picture"}
        </Button>
        {uploads.length > 0 && (
          <>
            <p>Your pictures</p>
            <div className="grid grid-cols-3 gap-2">
              {uploads.map((key, i) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Use uploaded picture ${i + 1}`}
                  aria-pressed={choice.backgroundKey === key}
                  onClick={() => choose({ backgroundKey: key })}
                  className="overflow-hidden rounded border border-border aria-pressed:ring-2 aria-pressed:ring-blue-600"
                >
                  <Picture choice={{ backgroundKey: key }} label={`Uploaded picture ${i + 1}`} />
                </button>
              ))}
            </div>
          </>
        )}
        <p className="font-medium">Presets</p>
        <div className="grid grid-cols-2 gap-2">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={choice.backgroundPreset === preset.id && !choice.backgroundKey}
              onClick={() =>
                choose({
                  backgroundPreset: preset.id,
                  backgroundFit: { ...DEFAULT_FIT, tile: true },
                })
              }
              className="overflow-hidden rounded border border-border text-left aria-pressed:ring-2 aria-pressed:ring-blue-600"
            >
              <img
                src={preset.url.replace(".webp", "-thumb.webp")}
                alt=""
                loading="lazy"
                className="h-14 w-full object-cover"
              />
              <span className="block p-2">{preset.label}</span>
            </button>
          ))}
        </div>
        {(choice.backgroundKey || choice.backgroundPreset) && (
          <div className="space-y-2">
            <Picture choice={choice} label={`${title} picture`} />
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
              <label key={key} className="block space-y-1">
                <span>
                  {label}
                  {key === "scale" ? ` · ${Math.round(fit.scale * 100)}%` : ""}
                </span>
                <input
                  type="range"
                  className="w-full accent-blue-600"
                  aria-label={`${title} ${label}`}
                  min={min}
                  max={max}
                  step={step}
                  value={Math.round(fit[key] * 100)}
                  disabled={key !== "scale" && fit.scale <= 1}
                  onChange={(e) => setFit({ [key]: Number(e.target.value) / 100 })}
                />
              </label>
            ))}
            <Button size="xs" variant="quiet" onClick={() => setFit(DEFAULT_FIT)}>
              Reset size and position
            </Button>
          </div>
        )}
        {target !== "main" && (
          <Button
            size="xs"
            variant="quiet"
            onClick={() =>
              setViewer({ backgrounds: { ...viewer.backgrounds, [target]: undefined } })
            }
          >
            Use default background
          </Button>
        )}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={viewer.backgroundLighting ?? false}
          onChange={(e) => {
            setViewer({ backgroundLighting: e.target.checked, background3D: false });
            setPreviewLook("studio");
          }}
        />
        Light background with HDRI
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
