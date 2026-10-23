import { coverLeaf } from "@/lib/portfolia/rigid-cover";
import { photoLighting, photoSpreadPages } from "@/lib/portfolia/photo-settings";
import { StudioLightingSettings, PaperSettings } from "./StudioAppearanceSettings";
import { BackgroundPresetPicker } from "./BackgroundPresetPicker";
import { PHOTO_EXPORT_REASON, PHOTO_SIZE_PRESETS, photoExportAction, photoSizeError, type PhotoSize } from "@/lib/portfolia/photo-export";
import { UpgradeModal } from "./UpgradeModal";
import { Segmented } from "./viewer-ui";
import { backgroundFor } from "@/lib/portfolia/background-settings";
import { backgroundPicture } from "@/lib/portfolia/background-presets";
import { useBlob, useObjectUrl } from "./Chrome";
import { useEffect, useRef, useState } from "react";
import { X, Download, RotateCcw, Sun, BookOpen, Image as ImageIcon, Camera, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlob } from "@/lib/portfolia/assets";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { BOOK_STYLES, readableBookStyle } from "@/lib/portfolia/book-style";
import { BACKGROUND_PRESETS } from "@/lib/portfolia/background-presets";
import { createPhotoShoot, SHOOT_ELEVATION, SHOOT_PRESETS, type ShootOptions } from "@/lib/portfolia/photo-shoot";
import { RIBBON_COLOURS, readableRibbonColour, ribbonSpreadPage } from "@/lib/portfolia/book-details";
import { DEFAULT_VIEWER, type ViewerSettings, type Portfolio } from "@/lib/portfolia/store";

export function PhotoShoot({ p, onClose }: { p: Portfolio; onClose: () => void }) {
  const frameHost = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null),
    stage = useRef<ReturnType<typeof createPhotoShoot> | null>(null);
  const [startingBackground] = useState(() =>
    backgroundFor({ ...DEFAULT_VIEWER, ...p.viewer }, "studio"),
  );
  const initialBlob = useBlob(startingBackground.backgroundKey),
    initialPicture = useObjectUrl(initialBlob),
    wallEdited = useRef(false);
  const [options, setOptions] = useState<ShootOptions>(() => ({
    style: readableBookStyle(p.viewer?.bookStyle),
    colour: startingBackground.backgroundColor ?? "#ded9cf",
    wall: backgroundPicture(startingBackground),
    floorColour: startingBackground.backgroundColor ?? "#ded9cf",
    ...photoLighting(p.viewer),
    ribbon: p.viewer?.ribbon,
    ribbonColour: p.viewer?.ribbonColour,
    layout: "lean",
    yaw: 20,
    elevation: 10,
    zoom: 1,
  }));
  const elevationRange = SHOOT_ELEVATION[options.layout ?? "lean"];
  const activePreset = SHOOT_PRESETS.find((preset) => preset.layout === (options.layout ?? "lean") && preset.yaw === options.yaw && preset.elevation === options.elevation && preset.zoom === options.zoom)?.id;
  const [tool, setTool] = useState<"customise" | "camera" | "export" | null>(null),
    [tab, setTab] = useState<"lighting" | "paper" | "background">("lighting"),
    [surface, setSurface] = useState<"wall" | "floor">("wall");
  const [size, setSize] = useState<PhotoSize>({ width: 2048, height: 2560 }),
    [preset, setPreset] = useState("portrait"),
    [deviceLimit, setDeviceLimit] = useState(8192),
    [previewSize, setPreviewSize] = useState({ width: 1, height: 1 });
  const sizeError = photoSizeError(size, deviceLimit),
    aspect = photoSizeError(size) ? 4 / 5 : size.width / size.height;
  useEffect(() => {
    if (initialPicture && !wallEdited.current)
      setOptions((current) => ({ ...current, wall: initialPicture }));
  }, [initialPicture]);
  useEffect(() => {
    const node = frameHost.current;
    if (!node) return;
    const fit = () => {
      const rect = node.getBoundingClientRect(),
        width = Math.min(rect.width, rect.height * aspect);
      setPreviewSize({ width, height: width / aspect });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    fit();
    return () => observer.disconnect();
  }, [aspect]);

  const latest = useRef(options);
  latest.current = options;
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [uploads, setUploads] = useState<{ wall?: string; floor?: string }>({});
  useEffect(() => {
    if (ready && !sizeError) stage.current?.setSize(size);
  }, [size.width, size.height, ready, sizeError]);
  const [selectedPage, setSelectedPage] = useState(0),
    [spreadBusy, setSpreadBusy] = useState(false),
    [spreadFailed, setSpreadFailed] = useState(false);
  const pageRenderer = useRef<((page: number) => Promise<HTMLCanvasElement>) | null>(null),
    frontRatio = useRef(1);
  const uploadUrls = useRef(new Set<string>());
  useEffect(
    () => () => {
      uploadUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    let cancelled = false,
      task: ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]> | undefined;
    let view: ReturnType<typeof createPhotoShoot> | undefined;
    setReady(false);
    setError("");
    void (async () => {
      const blob = await getBlob(p.pdf!.blobKey);
      if (!blob) throw new Error("The PDF is unavailable. Reopen the portfolio and try again.");
      const data = new Uint8Array(await blob.arrayBuffer()),
        pdfjs = await loadPdfjs();
      if (cancelled) return;
      task = pdfjs.getDocument({ data });
      const doc = await task.promise;
      const cache = new Map<number, Promise<HTMLCanvasElement>>();
      const render = async (pageNumber: number) => {
        const hit = cache.get(pageNumber);
        if (hit) return hit;
        const pending = (async () => {
          const page = await doc.getPage(pageNumber),
            native = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(2, 1800 / Math.max(native.width, native.height)),
          });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({
            canvasContext: canvas.getContext("2d")!,
            viewport,
            background: "#ffffff",
          }).promise;
          canvas.dataset["pageNumber"] = String(pageNumber);
          return canvas;
        })();
        cache.set(pageNumber, pending);
        while (cache.size > 6) cache.delete(cache.keys().next().value!);
        return pending;
      };
      pageRenderer.current = render;
      const front = await render(1),
        last = doc.numPages === 1 ? front : await render(doc.numPages);
      frontRatio.current = front.width / front.height;
      const back = document.createElement("canvas");
      back.width = front.width;
      back.height = front.height;
      const ctx = back.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, back.width, back.height);
      const scale = Math.min(back.width / last.width, back.height / last.height);
      ctx.drawImage(
        last,
        (back.width - last.width * scale) / 2,
        (back.height - last.height * scale) / 2,
        last.width * scale,
        last.height * scale,
      );
      if (cancelled) return;
      try {
        view = createPhotoShoot(
          host.current!,
          front,
          back,
          doc.numPages,
          (message) => {
            if (!cancelled) setError(message);
          },
          latest.current,
        );
      } catch {
        throw new Error(
          "3D graphics could not start on this device. Try a browser with WebGL enabled.",
        );
      }
      stage.current = view;
      view.set(latest.current);
      setDeviceLimit(view.exportLimit());
      setReady(true);
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "The photo shoot could not load.");
    });
    return () => {
      cancelled = true;
      view?.dispose();
      stage.current = null;
      pageRenderer.current = null;
      void task?.destroy();
    };
  }, [p.pdf?.blobKey]);
  useEffect(() => {
    stage.current?.set(options);
  }, [options]);
  useEffect(() => {
    if (!ready || !stage.current || !pageRenderer.current) return;
    let cancelled = false;
    setSpreadBusy(true);
    setSpreadFailed(false);
    if (selectedPage === 0) {
      stage.current.setSpread(null);
      setSpreadBusy(false);
      return;
    }
    const render = pageRenderer.current;
    const fit = (
      source: HTMLCanvasElement,
      leafIndex = Number(source.dataset["pageNumber"]) - 1,
      totalLeaves = p.pdf!.pages,
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = Math.round(1000 / frontRatio.current);
      canvas.dataset["coverBoard"] = String(coverLeaf(leafIndex, totalLeaves));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
      ctx.drawImage(
        source,
        (canvas.width - source.width * scale) / 2,
        (canvas.height - source.height * scale) / 2,
        source.width * scale,
        source.height * scale,
      );
      return canvas;
    };
    void (async () => {
      const selected = await render(selectedPage);
      const split =
        (p.viewer?.spreads === "ready" &&
          (selectedPage !== 1 || selected.width > selected.height)) ||
        selected.width / selected.height > frontRatio.current * 1.6;
      let canvases: readonly [HTMLCanvasElement | null, HTMLCanvasElement | null];
      if (split) {
        const halves = ([0, 1] as const).map((side) => {
          const half = document.createElement("canvas");
          half.width = Math.floor(selected.width / 2);
          half.height = selected.height;
          half
            .getContext("2d")!
            .drawImage(
              selected,
              side * half.width,
              0,
              half.width,
              half.height,
              0,
              0,
              half.width,
              half.height,
            );
          const mixed =
            frontRatio.current < 1 && selected.width / selected.height > frontRatio.current * 1.6;
          const index = mixed ? 1 + (selectedPage - 2) * 2 + side : (selectedPage - 1) * 2 + side;
          return fit(half, index, mixed ? 1 + (p.pdf!.pages - 1) * 2 : p.pdf!.pages * 2);
        });
        canvases = [halves[0]!, halves[1]!];
      } else {
        const pages = photoSpreadPages(selectedPage, p.pdf!.pages);
        canvases = (await Promise.all(
          pages.map(async (page) => (page ? fit(await render(page)) : null)),
        )) as [HTMLCanvasElement | null, HTMLCanvasElement | null];
      }
      if (!cancelled) stage.current?.setSpread(canvases);
    })()
      .catch(() => {
        if (!cancelled) {
          setSpreadFailed(true);
          setError("That spread could not be prepared. Choose another page.");
        }
      })
      .finally(() => {
        if (!cancelled) setSpreadBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPage, ready, p.pdf?.pages, p.viewer?.spreads]);
  const change = (patch: Partial<ShootOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));
  // The ribbon lies across the pages only on the spread the creator marked in the reader.
  useEffect(() => {
    const marked = ribbonSpreadPage(p.viewer?.ribbonPage, p.pdf!.pages);
    change({ ribbonMarked: marked !== undefined && selectedPage > 0 && (selectedPage === marked || (p.viewer?.spreads !== "ready" && photoSpreadPages(selectedPage, p.pdf!.pages).includes(marked))) });
  }, [selectedPage, p.viewer?.ribbonPage, p.viewer?.spreads, p.pdf?.pages]);
  const [upgrade, setUpgrade] = useState(false),
    gate = photoExportAction(p.plan);
  const download = async () => {
    if (gate === "upgrade") return setUpgrade(true);
    if (!stage.current || sizeError) return;
    setSaving(true);
    setError("");
    try {
      stage.current.setSize(size);
      const blob = await stage.current.png();
      if (!stage.current) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${(p.name || "book").replace(/[^a-zA-Z0-9_-]/g, "-")}-photo-${size.width}x${size.height}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export the picture.");
    } finally {
      setSaving(false);
    }
  };
  const drag = useRef<{ x: number; y: number; yaw: number; elevation: number } | null>(null);
  const shootViewer: Partial<ViewerSettings> = {
    studioLighting: options.hdri,
    finish: options.finish,
    studioBrightness: options.brightness,
    studioLightingStrength: options.strength,
    studioTopLight: options.topLight,
  };
  const changeAppearance = (patch: Partial<ViewerSettings>) =>
    change({
      ...(patch.studioLighting !== undefined ? { hdri: patch.studioLighting } : {}),
      ...(patch.finish !== undefined ? { finish: patch.finish } : {}),
      ...(patch.studioBrightness !== undefined ? { brightness: patch.studioBrightness } : {}),
      ...(patch.studioLightingStrength !== undefined
        ? { strength: patch.studioLightingStrength }
        : {}),
      ...(patch.studioTopLight !== undefined ? { topLight: patch.studioTopLight } : {}),
    });
  const colourKey = surface === "wall" ? "colour" : "floorColour";
  const changeSurface = (patch: Partial<ShootOptions>) => {
    setError("");
    if (surface === "wall") wallEdited.current = true;
    change(patch);
  };
  return (
    <section
      aria-label="Book photo shoot"
      className="absolute inset-0 z-50 flex flex-col bg-background"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (tool) setTool(null);
          else onClose();
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-medium">Photo shoot</h2>
        <Button size="sm" variant="quiet" onClick={onClose}>
          <X className="size-4" />
          Close photo shoot
        </Button>
      </header>
      <div className="relative min-h-0 flex-1 bg-muted">
        <div className="absolute inset-x-4 top-4 bottom-24 flex items-center justify-center">
          <div ref={frameHost} className="flex size-full items-center justify-center">
            <div className="relative shrink-0" style={previewSize}>
              <div
                ref={host}
                aria-label="3D book photograph preview"
                className="absolute inset-0 cursor-grab overflow-hidden rounded-lg"
                onPointerDown={(e) => {
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    yaw: options.yaw,
                    elevation: options.elevation,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const start = drag.current;
                  if (start)
                    change({
                      yaw: Math.max(-40, Math.min(40, start.yaw + (e.clientX - start.x) * 0.16)),
                      elevation: Math.max(
                        elevationRange[0],
                        Math.min(elevationRange[1], start.elevation + (e.clientY - start.y) * 0.1),
                      ),
                    });
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
              />
              {!ready && (
                <p
                  role="status"
                  className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm"
                >
                  {error || "Preparing your book…"}
                </p>
              )}
            </div>
          </div>
        </div>
        {ready && (error || spreadBusy) && (
          <p
            role={error ? "alert" : "status"}
            className="absolute left-1/2 top-2 z-10 max-w-[90%] -translate-x-1/2 rounded-lg bg-background/95 px-3 py-2 text-sm shadow-soft"
          >
            {error || "Preparing spread…"}
          </p>
        )}
        {tool && (
          <aside
            aria-label={
              tool === "customise"
                ? "Customise photo shoot"
                : tool === "camera"
                  ? "Photo camera"
                  : "Export photograph"
            }
            className="absolute right-3 top-3 bottom-24 z-20 w-[min(22rem,calc(100%-1.5rem))] overflow-auto rounded-2xl border border-border bg-background/95 p-5 text-sm shadow-lift backdrop-blur"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">
                {tool === "customise"
                  ? "Customise"
                  : tool === "camera"
                    ? "Camera"
                    : "Export photo"}
              </h3>
              <Button
                size="sm"
                variant="quiet"
                aria-label="Close photo shoot settings"
                onClick={() => setTool(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {tool === "customise" && (
              <div className="space-y-5">
                <p className="font-medium">Book style</p>
                <div
                  className="grid grid-cols-3 gap-2"
                  role="group"
                  aria-label="Photo shoot book style"
                >
                  {BOOK_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      aria-pressed={options.style === style.id}
                      onClick={() => change({ style: style.id })}
                      className="rounded-lg border border-border px-2 py-3 text-sm aria-pressed:border-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-foreground"
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
                {/* The ribbon bookmark is set aside for now; a hardback keeps its headband colour. */}
                {options.style === "hardback" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span>Headband colour</span>
                    {(
                      <div className="flex gap-1.5" role="radiogroup" aria-label="Headband colour">
                        {RIBBON_COLOURS.map((colour) => (
                          <button
                            key={colour}
                            type="button"
                            role="radio"
                            aria-checked={readableRibbonColour(options.ribbonColour) === colour}
                            aria-label={`Ribbon colour ${colour}`}
                            onClick={() => change({ ribbonColour: colour })}
                            className="size-5 rounded-full border border-black/15 aria-checked:ring-2 aria-checked:ring-foreground aria-checked:ring-offset-1"
                            style={{ background: colour }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label className="block space-y-2">
                  <span>Show</span>
                  <select
                    aria-label="Photo shoot page or spread"
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(Number(e.target.value))}
                    className="w-full rounded border border-border bg-background p-2"
                  >
                    <option value={0}>Closed book</option>
                    {Array.from({ length: p.pdf?.pages ?? 0 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Open at page {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <nav
                  aria-label="Photo appearance settings"
                  className="flex gap-1 border-b border-border pb-3"
                >
                  {(
                    [
                      ["lighting", "Lighting", Sun],
                      ["paper", "Paper", BookOpen],
                      ["background", "Background", ImageIcon],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <Button
                      key={id}
                      size="sm"
                      variant="quiet"
                      className="px-1.5 aria-pressed:bg-muted aria-pressed:text-foreground sm:px-3"
                      aria-pressed={tab === id}
                      onClick={() => setTab(id)}
                    >
                      <Icon className="size-4" />
                      {label}
                    </Button>
                  ))}
                </nav>
                <p className="text-xs text-muted-foreground">
                  These choices apply only to your photo shoot.
                </p>
                {tab === "lighting" && (
                  <StudioLightingSettings photo viewer={shootViewer} setViewer={changeAppearance} />
                )}
                {tab === "paper" && (
                  <PaperSettings viewer={shootViewer} setViewer={changeAppearance} />
                )}
                {tab === "background" && (
                  <div className="space-y-3">
                    <Segmented
                      label="Photo background surface"
                      value={surface}
                      options={
                        [
                          ["wall", "Wall"],
                          ["floor", "Floor"],
                        ] as const
                      }
                      onChange={setSurface}
                    />
                    <label className="flex items-center justify-between gap-3">
                      Colour
                      <input
                        aria-label={`${surface} colour`}
                        className="h-10 w-12 cursor-pointer rounded border border-border"
                        type="color"
                        value={options[colourKey]}
                        onChange={(e) =>
                          changeSurface({ [colourKey]: e.target.value, [surface]: undefined })
                        }
                      />
                    </label>
                    <input
                      id="photo-surface-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (!file) return;
                        if (!file.type.startsWith("image/") || file.size > 15 * 1048576) {
                          setError("Choose a picture up to 15 MB.");
                          return;
                        }
                        const url = URL.createObjectURL(file);
                        uploadUrls.current.add(url);
                        setUploads((current) => ({ ...current, [surface]: url }));
                        changeSurface({ [surface]: url });
                      }}
                    />
                    <Button
                      size="xs"
                      variant="line"
                      onClick={() => document.getElementById("photo-surface-upload")?.click()}
                    >
                      Upload picture
                    </Button>
                    {uploads[surface] && (
                      <button
                        type="button"
                        aria-pressed={options[surface] === uploads[surface]}
                        onClick={() => changeSurface({ [surface]: uploads[surface] })}
                        className="block w-full overflow-hidden rounded border border-border text-left aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-1"
                      >
                        <img
                          src={uploads[surface]}
                          alt="Uploaded picture"
                          className="h-16 w-full object-cover"
                        />
                        <span className="block p-2">Uploaded picture</span>
                      </button>
                    )}
                    <p className="font-medium">Presets</p>
                    <BackgroundPresetPicker
                      selected={
                        BACKGROUND_PRESETS.find((preset) => preset.url === options[surface])?.id
                      }
                      onSelect={(id) =>
                        changeSurface({
                          [surface]: BACKGROUND_PRESETS.find((preset) => preset.id === id)!.url,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}
            {tool === "camera" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Camera presets">
                  {SHOOT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      role="radio"
                      aria-checked={activePreset === preset.id}
                      onClick={() => change({ layout: preset.layout, yaw: preset.yaw, elevation: preset.elevation, zoom: preset.zoom })}
                      className="rounded-lg border border-border px-2 py-2.5 text-sm aria-checked:border-foreground aria-checked:bg-muted aria-checked:font-medium aria-checked:ring-1 aria-checked:ring-foreground"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground">Drag the preview to fine-tune the angle.</p>
                {(
                  [
                    ["yaw", "Camera angle", -40, 40, 1],
                    ["elevation", "Camera height", elevationRange[0], elevationRange[1], 1],
                    ["zoom", "Framing", 0.7, 1.4, 0.05],
                  ] as const
                ).map(([key, label, min, max, step]) => (
                  <label key={key} className="block space-y-2">
                    <span>
                      {label} · {options[key].toFixed(key === "zoom" ? 2 : 0)}
                      {key === "zoom" ? "×" : "°"}
                    </span>
                    <input
                      aria-label={label}
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={options[key]}
                      onChange={(e) => change({ [key]: Number(e.target.value) })}
                      className="w-full accent-leaf"
                    />
                  </label>
                ))}
                <Button
                  variant="line"
                  size="sm"
                  onClick={() => change({ layout: "lean", yaw: 20, elevation: 10, zoom: 1 })}
                >
                  <RotateCcw className="size-4" />
                  Reset camera
                </Button>
              </div>
            )}
            {tool === "export" && (
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span>Image size</span>
                  <select
                    aria-label="Photo size preset"
                    value={preset}
                    className="w-full rounded border border-border bg-background p-2"
                    onChange={(e) => {
                      setPreset(e.target.value);
                      const chosen = PHOTO_SIZE_PRESETS.find((item) => item.id === e.target.value);
                      if (chosen) setSize({ width: chosen.width, height: chosen.height });
                    }}
                  >
                    {PHOTO_SIZE_PRESETS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} · {item.width} × {item.height}
                      </option>
                    ))}
                    <option value="custom">Custom dimensions</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["width", "height"] as const).map((key) => (
                    <label key={key} className="space-y-2">
                      <span>{key === "width" ? "Width" : "Height"} (px)</span>
                      <input
                        type="number"
                        aria-label={`Photo ${key} in pixels`}
                        min={64}
                        max={deviceLimit}
                        step={1}
                        value={Number.isNaN(size[key]) ? "" : size[key]}
                        onChange={(e) => {
                          setPreset("custom");
                          setSize((current) => ({
                            ...current,
                            [key]: e.target.value === "" ? NaN : Number(e.target.value),
                          }));
                        }}
                        className="w-full rounded border border-border bg-background p-2"
                      />
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="line"
                  onClick={() => {
                    setPreset("custom");
                    setSize({ width: size.height, height: size.width });
                  }}
                >
                  Swap width & height
                </Button>
                {sizeError ? (
                  <p role="alert" className="text-destructive">
                    {sizeError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    PNG · {size.width} × {size.height} pixels. The preview uses the same framing as
                    your export.
                  </p>
                )}
                {preset.startsWith("amazon") && (
                  <p className="text-xs text-muted-foreground">
                    For Amazon A+ marketing content.{" "}
                    <a
                      href="https://kdp.amazon.com/en_US/help/topic/GCKLH8V7ULLD5EXY"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Amazon size guidance
                    </a>
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={!ready || saving || spreadBusy || spreadFailed || Boolean(sizeError)}
                  onClick={() => void download()}
                >
                  <Download className="size-4" />
                  {saving ? "Preparing PNG…" : "Download photograph"}
                  {gate === "upgrade" && <span className="rounded-full bg-leaf-soft px-1.5 py-0.5 text-xxs text-leaf">Personal</span>}
                </Button>
                {gate === "upgrade" && <p className="text-xs text-muted-foreground">Preview every angle for free. Downloading the photograph is part of Personal.</p>}
              </div>
            )}
          </aside>
        )}
        <nav
          aria-label="Photo shoot tools"
          className="absolute bottom-5 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border border-border bg-background/95 p-2 shadow-lift backdrop-blur"
        >
          {(
            [
              ["customise", "Customise", SlidersHorizontal],
              ["camera", "Camera", Camera],
              ["export", "Export", Download],
            ] as const
          ).map(([id, label, Icon]) => (
            <Button
              key={id}
              size="sm"
              variant="quiet"
              className="px-2 aria-pressed:bg-muted aria-pressed:text-foreground sm:px-3"
              aria-expanded={tool === id}
              aria-pressed={tool === id}
              onClick={() => setTool((current) => (current === id ? null : id))}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </nav>
      </div>
      <UpgradeModal open={upgrade} reason={PHOTO_EXPORT_REASON} onClose={() => setUpgrade(false)} />
    </section>
  );
}
