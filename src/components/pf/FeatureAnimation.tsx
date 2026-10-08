import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Code, Link, MousePointer2, Check } from "lucide-react";
import { BookView } from "./BookView";
import { registerPublicUrls, uid } from "@/lib/portfolia/assets";
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
const START: Record<FeatureId, number> = {
  book: 3,
  paged: 4,
  scroll: 5,
  background: 6,
  lighting: 9,
  notes: 10,
  tabs: 11,
  share: 12,
};
const LOOP = [0, 1, 2, 3, 2, 1];
// Local demonstration only. These are supported scrapbook settings, never saved to the portfolio.
const NOTES: Foldout[] = [
  {
    id: "showcase_note",
    page: 10,
    half: "right",
    title: "A closer look",
    colour: "#efe5d2",
    hinge: "top",
    x: 0.18,
    y: 0.5,
    width: 0.46,
    height: 0.32,
    outside: {
      colour: "#efe5d2",
      text: "A closer look",
      font: "hand",
      align: "center",
      valign: "middle",
    },
    inside: {
      colour: "#f5f0e7",
      text: "",
      imageFit: "cover",
      font: "hand",
      align: "center",
      valign: "middle",
    },
  },
];
const TAGS: PageTag[] = [11, 12, 13, 14].map((page) => ({
  id: `showcase_${page}`,
  page,
  label: String(page),
  colour: ["#dfaa70", "#9aaed0", "#b8bc9c", "#d1abb2"][page - 11]!,
}));

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
  const [detailKey] = useState(() => uid("showcase_detail"));
  const notes = useMemo(
    () =>
      NOTES.map((note) => ({
        ...note,
        inside: { ...note.inside!, imageKey: detailKey },
      })),
    [detailKey],
  );
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
      if (loaded.numPages < 14)
        throw new Error("The demonstration needs all 14 lookbook pages.");
      const dimensions: { w: number; h: number }[] = [];
      const artwork: Record<number, string> = {};
      for (let n = 1; n <= loaded.numPages; n++) {
        if (cancelled) return;
        const page = await loaded.getPage(n);
        const base = page.getViewport({ scale: 1 });
        dimensions.push({ w: base.width, h: base.height });
        if ([4, 5, 6, 7, 8, 10, 12, 13].includes(n)) {
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
          if (n === START.notes) {
            // A close-up taken directly from the right-hand artwork of this PDF page.
            const detail = document.createElement("canvas");
            detail.width = 1000;
            detail.height = 700;
            detail
              .getContext("2d")!
              .drawImage(
                canvas,
                canvas.width * 0.58,
                canvas.height * 0.2,
                canvas.width * 0.34,
                canvas.height * 0.58,
                0,
                0,
                1000,
                700,
              );
            registerPublicUrls({
              [detailKey]: detail.toDataURL("image/webp", 0.94),
            });
            detail.width = detail.height = 0;
          }
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
  }, [url, onError, detailKey]);
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
    if (!isBook && images[START[feature]] && images[START[feature] + 1]) {
      setReady(true);
      onReady(true);
    }
  }, [images, isBook, feature, onReady]);
  useEffect(() => {
    if (!playing || !ready) return;
    const timer = setInterval(
      () => setBeat((n) => n + 1),
      feature === "lighting" ? 3500 : 2800,
    );
    return () => clearInterval(timer);
  }, [playing, ready, feature]);
  useEffect(() => {
    if (!beat || !playing || !isBook || feature === "notes") return;
    if (feature === "tabs") {
      const target = host.current?.querySelector<HTMLButtonElement>(
        `button[data-page-tab][aria-label="Go to ${11 + LOOP[beat % LOOP.length]!} · page ${11 + LOOP[beat % LOOP.length]!}"]`,
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
        `button[aria-label="Turn to ${(beat - 1) % 6 < 3 ? "next" : "previous"} page"]`,
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
          : feature === "lighting"
            ? "#d9cdb6"
            : MIDNIGHT,
      ...(feature === "lighting"
        ? { studioLighting: (["1", "2", "3"] as const)[beat % 3] }
        : {}),
    }),
    [settings, feature, beat],
  );
  const jump = useMemo(
    () => ({
      page: START[feature],
      t: 1,
    }),
    [feature],
  );
  const art = (page: number, className = "", key?: number) => (
    <img
      key={key}
      className={className}
      src={images[page]}
      alt=""
      draggable={false}
    />
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
            demoTurnDurationScale={feature === "lighting" ? 2.5 : 1}
            foldouts={feature === "notes" ? notes : undefined}
            tags={feature === "tabs" ? TAGS : undefined}
            demoNotes={feature === "notes" && playing && beat % 3 !== 2}
          />
        )}
        {!isBook && images[START[feature]] && (
          <>
            {feature === "paged" && (
              <div className="pf-motion-window">
                <div className="pf-motion-pages">
                  {[4, 5, 6, 7, 4].map((page, index) => art(page, "", index))}
                </div>
              </div>
            )}
            {feature === "scroll" && (
              <div className="pf-motion-scroll">
                <div>
                  {[5, 6, 7, 8, 5].map((page, index) => art(page, "", index))}
                </div>
              </div>
            )}
            {feature === "share" && (
              <div className="pf-motion-share">
                <div className="pf-share-source">
                  {art(12)}
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
                  {art(13)}
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
            ? `Studio · Lighting ${(beat % 3) + 1} · Pages 9–12`
            : feature === "notes"
              ? "Scrapbook · Demonstration note"
              : ""}
        </span>
      )}
    </div>
  );
}
