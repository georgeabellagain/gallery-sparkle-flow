import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Code, Link, MousePointer2, Check } from "lucide-react";
import { BookView } from "./BookView";
import { loadPdfjs } from "@/lib/portfolia/pdf";
import { DEFAULT_VIEWER, type ViewerSettings } from "@/lib/portfolia/store";
import type { Foldout } from "@/lib/portfolia/foldouts";
import type { PageTag } from "@/lib/portfolia/page-extras";

export type FeatureId =
  | "book"
  | "paged"
  | "scroll"
  | "background"
  | "lighting"
  | "notes"
  | "tabs"
  | "share";
const MIDNIGHT = "#10162e";
const noop = () => {};
// Local demonstration only. These are supported scrapbook settings, never saved to the portfolio.
const NOTES: Foldout[] = [
  {
    id: "showcase_note",
    page: 9,
    half: "right",
    title: "A closer look",
    colour: "#ded2bb",
    hinge: "top",
    x: 0.18,
    y: 0.5,
    width: 0.46,
    height: 0.32,
    outside: {
      colour: "#ded2bb",
      text: "A closer look",
      font: "serif",
      align: "center",
      valign: "middle",
    },
    inside: {
      colour: "#f5f0e7",
      text: "Ideas, details,\nand the story behind the work.",
      font: "serif",
      align: "center",
      valign: "middle",
    },
  },
];
const TAGS: PageTag[] = [
  { id: "showcase_9", page: 9, label: "09", colour: "#dfaa70" },
  { id: "showcase_10", page: 10, label: "10", colour: "#9aaed0" },
];

/** Presentation-only loops: PDF artwork plus the actual book renderer, with no reader/editor UI. */
export function FeatureAnimation({
  url,
  feature,
  playing,
  settings,
  onReady,
  onError,
}: {
  url: string;
  feature: FeatureId;
  playing: boolean;
  settings?: ViewerSettings;
  onReady: (value: boolean) => void;
  onError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [ready, setReady] = useState(false);
  const [beat, setBeat] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const isBook = ["book", "background", "lighting", "notes", "tabs"].includes(
    feature,
  );
  useEffect(() => {
    let cancelled = false;
    let task:
      | ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>
      | undefined;
    setDoc(null);
    setImages({});
    void (async () => {
      const pdfjs = await loadPdfjs();
      if (cancelled) return;
      task = pdfjs.getDocument({ url });
      const loaded = await task.promise;
      if (loaded.numPages < 10)
        throw new Error("The demonstration needs pages 9–10.");
      const dimensions: { w: number; h: number }[] = [];
      const artwork: Record<number, string> = {};
      for (let n = 1; n <= loaded.numPages; n++) {
        if (cancelled) return;
        const page = await loaded.getPage(n);
        const base = page.getViewport({ scale: 1 });
        dimensions.push({ w: base.width, h: base.height });
        if ([2, 3, 9, 10].includes(n)) {
          const viewport = page.getViewport({
            scale: Math.min(1600 / base.width, 1600 / base.height),
          });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({
            canvasContext: canvas.getContext("2d")!,
            viewport,
          }).promise;
          artwork[n] = canvas.toDataURL("image/webp", 0.92);
          canvas.width = canvas.height = 0;
        }
      }
      if (!cancelled) {
        setSizes(dimensions);
        setImages(artwork);
        setDoc(loaded);
      }
    })().catch(() => {
      if (!cancelled) onError();
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, onError]);
  useEffect(() => {
    setReady(false);
    setBeat(0);
    setCursor(null);
    onReady(false);
  }, [feature, onReady]);
  const bookReady = useCallback(
    (value: boolean) => {
      setReady(value);
      onReady(value);
    },
    [onReady],
  );
  useEffect(() => {
    if (!isBook && images[2] && images[3]) {
      setReady(true);
      onReady(true);
    }
  }, [images, isBook, feature, onReady]);
  useEffect(() => {
    if (!playing || !ready) return;
    const timer = setInterval(() => setBeat((n) => n + 1), 2800);
    return () => clearInterval(timer);
  }, [playing, ready, feature]);
  useEffect(() => {
    if (!beat || !playing || !isBook || feature === "notes") return;
    if (feature === "tabs") {
      const target = host.current?.querySelector<HTMLButtonElement>(
        `button[data-page-tab][aria-label="Go to ${beat % 2 ? "10 · page 10" : "09 · page 9"}"]`,
      );
      if (!target || target.disabled) return;
      const bounds = target.getBoundingClientRect(),
        parent = host.current!.getBoundingClientRect();
      setCursor({
        x: bounds.left - parent.left + bounds.width / 2,
        y: bounds.top - parent.top + bounds.height / 2,
      });
      const click = setTimeout(() => target.click(), 450);
      const hide = setTimeout(() => setCursor(null), 950);
      return () => {
        clearTimeout(click);
        clearTimeout(hide);
      };
    }
    host.current
      ?.querySelector<HTMLButtonElement>(
        `button[aria-label="Turn to ${beat % 2 ? "next" : "previous"} page"]`,
      )
      ?.click();
    return undefined;
  }, [beat, feature, isBook, playing]);
  const viewer = useMemo<ViewerSettings>(
    () => ({
      ...DEFAULT_VIEWER,
      ...settings,
      mode: "book",
      modes: ["book"],
      look: feature === "book" ? "clean" : "studio",
      looks: ["clean", "studio"],
      backgroundKey: undefined,
      backgroundColor:
        feature === "background"
          ? [MIDNIGHT, "#b5a68d", "#d5d7dd"][beat % 3]
          : MIDNIGHT,
      ...(feature === "lighting"
        ? { studioLighting: (["1", "2", "3"] as const)[beat % 3] }
        : {}),
    }),
    [settings, feature, beat],
  );
  const jump = useMemo(
    () => ({
      page: ["lighting", "notes", "tabs"].includes(feature) ? 9 : 2,
      t: 1,
    }),
    [feature],
  );
  const art = (page: number, className = "") => (
    <img className={className} src={images[page]} alt="" draggable={false} />
  );
  return (
    <div
      ref={host}
      className={`pf-feature-animation pf-feature-${feature}`}
      data-playing={playing}
      role="img"
      aria-label={`${feature === "notes" ? "Demonstration scrapbook flap on" : "Animated feature demonstration using"} Scarlett Bushell’s portfolio`}
    >
      <div
        className="pf-feature-art"
        style={{ visibility: ready ? "visible" : "hidden" }}
        inert
      >
        {isBook && doc && (
          <BookView
            key={feature}
            doc={doc}
            sizes={sizes}
            zoom={1}
            onZoomChange={noop}
            jump={jump}
            onPage={noop}
            viewer={viewer}
            colour={viewer.backgroundColor ?? MIDNIGHT}
            tone="dark"
            awake={false}
            fullSpread
            lightweight
            onReadyChange={bookReady}
            onRenderError={onError}
            foldouts={feature === "notes" ? NOTES : undefined}
            tags={feature === "tabs" ? TAGS : undefined}
            demoNotes={feature === "notes" && playing && beat % 3 !== 2}
          />
        )}
        {!isBook && images[2] && (
          <>
            {feature === "paged" && (
              <div className="pf-motion-window">
                <div className="pf-motion-pages">
                  {art(2)}
                  {art(3)}
                </div>
              </div>
            )}
            {feature === "scroll" && (
              <div className="pf-motion-scroll">
                <div>
                  {art(2)}
                  {art(3)}
                  {art(2)}
                </div>
              </div>
            )}
            {feature === "share" && (
              <div className="pf-motion-share">
                <div className="pf-share-source">
                  {art(2)}
                  <span>Scarlett Bushell</span>
                </div>
                <div className="pf-share-link">
                  <Link size={16} /> portfolia.site/p/adu2v <Check size={16} />
                </div>
                <div className="pf-share-site">
                  <div>
                    <i />
                    <i />
                    <i />
                    <Code size={16} />
                  </div>
                  {art(3)}
                  <span>Your website</span>
                </div>
              </div>
            )}
          </>
        )}
        {cursor && (
          <MousePointer2
            className="pf-demo-cursor"
            style={{ left: cursor.x, top: cursor.y }}
            fill="white"
            stroke="#10162e"
          />
        )}
      </div>
      {ready && (
        <span className="pf-animation-caption">
          {feature === "lighting"
            ? `Studio · Lighting ${(beat % 3) + 1} · Pages 9–10`
            : feature === "notes"
              ? "Scrapbook · Demonstration note"
              : ""}
        </span>
      )}
    </div>
  );
}
