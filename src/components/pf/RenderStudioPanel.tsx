import { studioCaptureCapability } from "@/lib/portfolia/studio-recorder";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
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
  renderSignature,
  renderedKeys,
  type StudioExporter,
} from "@/lib/portfolia/rendered-studio";

export function RenderStudioPanel({ p, onClose }: { p: Portfolio; onClose: () => void }) {
  const pdf = useBlob(p.pdf?.blobKey),
    bg = useBlob(p.viewer?.backgroundKey);
  const [bgUrl, setBgUrl] = useState<string>(),
    [exporter, setExporter] = useState<StudioExporter | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("Preparing Studio…"),
    [error, setError] = useState(""),
    [generation, setGeneration] = useState(0);
  const [capability, setCapability] = useState<"checking" | "offline" | "realtime" | "unsupported">(
    "checking",
  );
  useEffect(() => {
    let active = true;
    void studioCaptureCapability().then((c) => {
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
    setError("");
    keys.current = [];
    const abort = new AbortController();
    controller.current = abort;
    try {
      const pack = await exporter.render(
        renderSignature(p),
        async (blob) => {
          abort.signal.throwIfAborted();
          const key = uid("render");
          keys.current.push(key);
          await putBlob(key, blob);
          return key;
        },
        setProgress,
        abort.signal,
      );
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
        Create 1080p page turns and note animations. Frame-by-frame rendering uses 60 FPS where
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
      <p className="my-3 text-xs text-muted-foreground">
        {capability === "offline"
          ? "Frame-by-frame 1080p / 60 FPS rendering."
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
            Close
          </Button>
        )}
      </div>
      <div
        className="pf-render-capture pointer-events-none fixed left-[-10000px] top-0 h-[1080px] w-[1920px]"
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
