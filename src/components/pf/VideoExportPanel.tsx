import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useBlob } from "./Chrome";
import { PdfViewer } from "./PdfViewer";
import { DEFAULT_VIEWER, useDoc, type Portfolio } from "@/lib/portfolia/store";
import type { StudioExporter } from "@/lib/portfolia/rendered-studio";
import { studioCaptureCapability } from "@/lib/portfolia/studio-recorder";

/** Download-only export: never changes the published viewer or uploads a render. */
export function VideoExportPanel({ p, onClose }: { p: Portfolio; onClose: () => void }) {
  const personal = useDoc().account.signedIn && p.plan === "personal";
  const pdf = useBlob(p.pdf?.blobKey), background = useBlob(p.viewer?.backgroundKey);
  const source = useRef<{ blob: Blob } | null>(null);
  if (pdf && source.current?.blob !== pdf) source.current = { blob: pdf };
  const [backgroundUrl, setBackgroundUrl] = useState<string>();
  const [exporter, setExporter] = useState<StudioExporter | null>(null);
  const receive = useCallback((value: StudioExporter | null) => setExporter(value), []);
  const [capability, setCapability] = useState("checking");
  const [busy, setBusy] = useState(false), [fraction, setFraction] = useState(0);
  const [status, setStatus] = useState("Preparing your flipbook…"), [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; extension: string }>();
  const [generation, setGeneration] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { let alive = true; void studioCaptureCapability(1920, 1080).then(value => { if (alive) setCapability(value); }); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (!background) { setBackgroundUrl(undefined); return; }
    const url = URL.createObjectURL(background); setBackgroundUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [background]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) controller.current?.abort(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { controller.current?.abort(); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  const start = async () => {
    if (!personal || !exporter || busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setResult(undefined); setFraction(0);
    try {
      const blob = await exporter.video((text, value) => { setStatus(text); if (value !== undefined) setFraction(value); }, abort.signal);
      abort.signal.throwIfAborted();
      setResult({ url: URL.createObjectURL(blob), extension: blob.type.includes("mp4") ? "mp4" : "webm" });
      setFraction(1); setStatus("Your HD video is ready.");
    } catch (e) {
      setError(abort.signal.aborted ? "Export cancelled. Keep this tab visible while exporting." : e instanceof Error ? e.message : "Video export failed.");
      setExporter(null); setGeneration(value => value + 1);
    } finally { setBusy(false); controller.current = null; }
  };
  if (typeof document === "undefined" || !personal) return null;
  return createPortal(<dialog open aria-modal="true" aria-label="Export HD flipbook video" className="fixed inset-0 z-[110] m-auto max-h-[95dvh] w-[min(95vw,36rem)] overflow-auto border bg-background p-6 text-foreground shadow-lift">
    <h2 className="text-lg font-medium">Export HD video</h2>
    <p className="mt-2 text-sm text-muted-foreground">Download a 1920 × 1080 video that flips through your portfolio in Studio, with your lighting, paper and background. 60 FPS MP4 where supported; other browsers may export WebM. Keep this tab visible until finished.</p>
    <p role="status" className="mt-4 text-sm">{!busy && !result && exporter ? "Ready to export." : status}</p>
    <progress aria-label="Video export progress" max={1} value={fraction} className="mt-3 w-full accent-foreground" />
    <p className="text-xs tabular-nums">{Math.round(fraction * 100)}%</p>
    {capability === "realtime" && <p className="mt-2 text-xs text-muted-foreground">This browser records in real time; smoothness depends on your device.</p>}
    {capability === "unsupported" && <p role="alert" className="mt-2 text-sm">Video export is unavailable in this browser. Try Chrome or Edge.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {!result && <Button disabled={!exporter || busy || capability === "checking" || capability === "unsupported" || (!!p.viewer?.backgroundKey && !background)} onClick={() => void start()}>Export video</Button>}
      {result && <Button asChild><a href={result.url} download={`${(p.name || "portfolio").replace(/[^a-z0-9 _-]/gi, "").trim() || "portfolio"}-HD.${result.extension}`}>Download video</a></Button>}
      {busy ? <Button variant="line" onClick={() => controller.current?.abort()}>Cancel export</Button> : <Button variant="quiet" onClick={onClose}>{result ? "Finish" : "Close"}</Button>}
    </div>
    <div className="pf-render-capture pointer-events-none fixed left-[-10000px] top-0" style={{ width: 960, height: 540, "--pf-render-height": "540px" } as React.CSSProperties} aria-hidden="true" inert>
      {pdf && <PdfViewer key={generation} source={source.current} fileName={p.pdf?.name ?? "portfolio.pdf"} viewer={{ ...DEFAULT_VIEWER, ...p.viewer, mode: "book", look: "studio", looks: ["studio"], modes: ["book"] }} backgroundUrl={backgroundUrl} backdrop={p.style?.backdrop} foldouts={p.pdf?.foldouts} tags={p.pdf?.tags} links={p.pdf?.links} controls={false} onExporter={receive} renderCapture onLoadError={setError} />}
    </div>
  </dialog>, document.body);
}
