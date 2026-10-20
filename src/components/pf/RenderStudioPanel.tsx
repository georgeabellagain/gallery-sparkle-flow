import { studioRenderDimensions } from "@/lib/portfolia/render-framing";
import { studioCaptureCapability } from "@/lib/portfolia/studio-recorder";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { PdfViewer } from "./PdfViewer";
import { useBlob } from "./Chrome";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_VIEWER,
  deleteUnusedPortfolioAsset,
  getDoc,
  patchPortfolio,
  type Portfolio,
} from "@/lib/portfolia/store";
import { putBlob, uid, formatBytes } from "@/lib/portfolia/assets";
import {
  currentRender,
  renderSignature,
  renderedKeys,
  type StudioExporter,
} from "@/lib/portfolia/rendered-studio";

export function RenderStudioPanel({ p, onClose }: { p: Portfolio; onClose: () => void }) {
  const dimensions = useRef(studioRenderDimensions(typeof window === "undefined" ? 1920 : window.innerWidth, typeof window === "undefined" ? 1080 : Math.max(1, window.innerHeight - 56)));
  const pdf = useBlob(p.pdf?.blobKey),
    bg = useBlob(p.viewer?.backgroundKey);
  const [bgUrl, setBgUrl] = useState<string>(),
    [exporter, setExporter] = useState<StudioExporter | null>(null),
    [busy, setBusy] = useState(false),
    [fraction, setFraction] = useState(0),
    [finished, setFinished] = useState(false),
    [preview, setPreview] = useState(false),
    [progress, setProgress] = useState("Preparing Studio…"),
    [error, setError] = useState(""),
    [generation, setGeneration] = useState(0);
  const [capability, setCapability] = useState<"checking" | "offline" | "realtime" | "unsupported">(
    "checking",
  );
  useEffect(() => {
    let active = true;
    void studioCaptureCapability(dimensions.current.width, dimensions.current.height).then((c) => {
      if (active) setCapability(c);
    });
    return () => {
      active = false;
    };
  }, []);
  const controller = useRef<AbortController | null>(null),
    keys = useRef<string[]>([]);
  const source = useRef<{ blob: Blob } | null>(null);
  if (pdf && source.current?.blob !== pdf) source.current = { blob: pdf };
  const receive = useCallback((value: StudioExporter | null) => setExporter(value), []);
  useEffect(() => {
    if (!bg) {
      setBgUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(bg);
    setBgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [bg]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) controller.current?.abort();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      controller.current?.abort();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const render = async () => {
    if (!exporter || !p.pdf) return;
    setBusy(true);
    setFinished(false); setFraction(0);
    setError("");
    keys.current = [];
    const uploads: Promise<void>[] = [], activeUploads = new Set<Promise<void>>();
    let uploadError: unknown;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const pack = await exporter.render(
        renderSignature(p),
        async (blob) => {
          abort.signal.throwIfAborted();
          if(uploadError)throw uploadError;
          if(activeUploads.size>=2)await Promise.race(activeUploads);
          abort.signal.throwIfAborted();
          const key = uid("render");keys.current.push(key);
          const upload=putBlob(key,blob);uploads.push(upload);activeUploads.add(upload);
          void upload.then(()=>activeUploads.delete(upload),error=>{activeUploads.delete(upload);uploadError=error;});
          return key;
        },
        (text, value) => { setProgress(text); if (value !== undefined) setFraction(value * .95); },
        abort.signal,
      );
      setProgress("Saving rendered files…");
      await Promise.all(uploads);
      abort.signal.throwIfAborted();
      const current = getDoc().portfolio;
      if (!current?.pdf || current.code !== p.code || renderSignature(current) !== pack.signature)
        throw new Error(
          "The portfolio changed during rendering. Please render the updated version.",
        );
      const previous = renderedKeys(current.pdf.renderedStudio);
      if (
        !patchPortfolio({
          pdf: { ...current.pdf, renderedStudio: pack },
          viewer: { ...DEFAULT_VIEWER, ...current.viewer, studioPlayback: "rendered" },
        })
      )
        throw new Error("The render could not be saved.");
      keys.current = [];
      previous.forEach((key) => void deleteUnusedPortfolioAsset(key));
      setFinished(true); setFraction(1);
      setProgress(
        `Ready — ${formatBytes(pack.bytes)}. Rendered Studio will be used on your published link.`,
      );
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Rendering cancelled."
          : e instanceof Error
            ? e.message
            : "Rendering failed.",
      );
      // Let in-flight saves finish before deleting failed/cancelled assets.
      await Promise.allSettled(uploads);
      await Promise.all(keys.current.map((key) => deleteUnusedPortfolioAsset(key)));
      keys.current = [];
    } finally {
      if (abort.signal.aborted) {
        setExporter(null);
        setGeneration((v) => v + 1);
      }
      setBusy(false);
      controller.current = null;
    }
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      open
      aria-modal="true"
      aria-label="Render Studio flipbook"
      className="fixed inset-0 z-[100] m-auto max-h-[95dvh] w-[min(95vw,48rem)] overflow-auto rounded-2xl border border-border bg-background p-5 text-foreground shadow-lift"
    >
      <h2 className="text-lg font-medium">Render Studio flipbook</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create high-resolution page turns and note animations. Frame-by-frame rendering uses 60 FPS where
        supported. Keep this tab open while rendering. Your editor stays live; shared Studio views
        use the finished render.
      </p>
      <p role="status" className="my-4 text-sm">
        {busy
          ? progress
          : exporter
            ? progress === "Preparing Studio…"
              ? "Ready to render."
              : progress
            : progress}
      </p>
      <div className="my-3">
        <progress aria-label="Rendering progress" max={100} value={Math.round(fraction * 100)} className="h-2 w-full accent-foreground" />
        <p className="mt-1 text-xs tabular-nums">{Math.round(fraction * 100)}%</p>
      </div>
      <p className="my-3 text-xs text-muted-foreground">
        {capability === "offline"
          ? "Frame-by-frame high-resolution / 60 FPS rendering."
          : capability === "realtime"
            ? "Real-time recording: animation quality depends on this device."
            : capability === "unsupported"
              ? "This browser cannot render video. Try Chrome or Edge."
              : "Checking video rendering support…"}
      </p>
      {error && (
        <p role="alert" className="my-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={
            finished ||
            !exporter ||
            busy ||
            capability === "unsupported" ||
            capability === "checking" ||
            (!!p.viewer?.backgroundKey && !bg)
          }
          onClick={() => void render()}
        >
          Render in HD
        </Button>
        {busy ? (
          <Button variant="line" onClick={() => controller.current?.abort()}>
            Cancel rendering
          </Button>
        ) : (
          <Button variant="quiet" onClick={onClose}>
            {finished ? "Finish" : "Close"}
          </Button>
        )}
        {finished && <Button variant="line" onClick={() => setPreview(true)}>View rendered version</Button>}
      </div>
      {preview && <RenderedStudioPreview p={getDoc().portfolio ?? p} onClose={() => setPreview(false)} />}
      <div
        className="pf-render-capture pointer-events-none fixed left-[-10000px] top-0"
        style={{width: dimensions.current.width/2, height: dimensions.current.height/2, "--pf-render-height": `${dimensions.current.height/2}px`} as CSSProperties}
        aria-hidden="true"
        inert
      >
        {pdf && (
          <PdfViewer
            key={generation}
            source={source.current}
            fileName={p.pdf?.name ?? "portfolio.pdf"}
            viewer={{
              ...DEFAULT_VIEWER,
              ...p.viewer,
              mode: "book",
              look: "studio",
              looks: ["studio"],
              modes: ["book"],
            }}
            backgroundUrl={bgUrl}
            backdrop={p.style?.backdrop}
            foldouts={p.pdf?.foldouts}
            tags={p.pdf?.tags}
            links={p.pdf?.links}
            controls={false}
            onExporter={receive}
            renderCapture
            onLoadError={setError}
          />
        )}
      </div>
    </dialog>,
    document.body,
  );
}


export function RenderedStudioPreview({ p, onClose }: { p: Portfolio; onClose: () => void }) {
  const pack = currentRender(p), pdf = useBlob(p.pdf?.blobKey), background = useBlob(p.viewer?.backgroundKey);
  const [backgroundUrl, setBackgroundUrl] = useState<string>();
  const source = useRef<{blob: Blob} | null>(null);
  if(pdf && source.current?.blob !== pdf) source.current={blob:pdf};
  useEffect(()=>{
    if(!background){setBackgroundUrl(undefined);return;}
    const url=URL.createObjectURL(background);setBackgroundUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[background]);
  if (!pack || typeof document === "undefined") return null;
  return createPortal(<dialog open aria-modal="true" aria-label="Rendered portfolio preview" className="fixed inset-0 z-[110] m-auto h-[95dvh] w-[95vw] overflow-auto rounded-2xl border bg-background p-3 text-foreground shadow-lift">
    <div className="flex items-center justify-between gap-2 pb-2">
      <h2 className="font-medium">Rendered version</h2>
      <Button size="sm" onClick={onClose}>Back to editing</Button>
    </div>
    {pdf ? <PdfViewer source={source.current} fileName={p.pdf?.name ?? "portfolio.pdf"}
      viewer={{...DEFAULT_VIEWER,...p.viewer,mode:"book",look:"studio",looks:["clean","studio"],modes:["book"]}}
      initialLook="studio" renderedStudio={pack} backgroundUrl={backgroundUrl} backdrop={p.style?.backdrop}
      foldouts={p.pdf?.foldouts} tags={p.pdf?.tags} links={p.pdf?.links} videos={p.pdf?.videos} fullSpread /> : <p>Loading portfolio…</p>}
  </dialog>, document.body);
}
