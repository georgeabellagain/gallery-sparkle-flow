import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FoldoutCard } from "@/components/pf/FoldoutCard";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
import { fitFoldout, type Foldout } from "@/lib/portfolia/foldouts";
import { registerPublicUrls } from "@/lib/portfolia/assets";

export const Route = createFileRoute("/scrapbook-preview")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Scrapbook prototype — Portfolia" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ScrapbookPreview,
});
const sample: Foldout = {
  id: "coast-flap",
  imageKey: "scrapbook_demo_coast",
  page: 2,
  half: "right",
  title: "Beyond the frame",
  hinge: "left",
  colour: "#d6dfd0",
  x: 0.55,
  y: 0.38,
  width: 0.32,
  height: 0.38,
};
function ScrapbookPreview() {
  const [item, setItem] = useState(sample);
  const [phone, setPhone] = useState(false);
  const [book, setBook] = useState(false);
  useEffect(() => {
    registerPublicUrls({ scrapbook_demo_coast: "/examples/quiet-coast.jpg" });
  }, []);
  return (
    <main className="min-h-screen bg-[#e9e6df] px-5 py-12 text-[#292722]">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[.2em]">
          Portfolia / Unpublished prototype
        </p>
        <h1 className="mt-3 font-serif text-4xl">A little more to discover.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6">
          Click the paper flap to reveal the image. Click again or press Escape
          to close. This demo uses a fictional, AI-generated coastal photograph
          already used in the photography example.
        </p>
        <div className="my-6 flex flex-wrap items-center gap-4 text-sm">
          <label>
            Opening direction{" "}
            <select
              className="ml-2 rounded border bg-white p-2"
              value={item.hinge}
              onChange={(e) =>
                setItem(
                  fitFoldout({
                    ...item,
                    hinge: e.target.value as Foldout["hinge"],
                  }),
                )
              }
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Paper colour{" "}
            <input
              type="color"
              value={item.colour}
              onChange={(e) => setItem({ ...item, colour: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={phone}
              onChange={(e) => setPhone(e.target.checked)}
            />{" "}
            Phone width
          </label>
        </div>
        <div
          className="relative mx-auto aspect-[4/5] w-full bg-[#fbf8ef] shadow-xl"
          style={{ maxWidth: phone ? 340 : 580 }}
        >
          <div className="absolute inset-x-[9%] top-[9%] border-t border-[#292722]/25 pt-4">
            <p className="text-[10px] uppercase tracking-[.2em]">
              Coastal studies / 02
            </p>
            <h2 className="mt-4 font-serif text-3xl">
              Notes from
              <br />
              the shoreline.
            </h2>
            <p className="mt-4 max-w-[60%] text-xs leading-relaxed">
              An extra photograph, tucked into the page. Unfold to explore the
              wider view.
            </p>
          </div>
          <FoldoutCard
            key={`${item.hinge}:${item.colour}`}
            item={item}
          />
          <p className="absolute bottom-[7%] left-[9%] text-[10px] uppercase tracking-widest">
            Collected moments / Portfolia
          </p>
        </div>
        <p className="mt-5 text-center text-xs">
          Keyboard: Tab to the flap, Enter or Space to open, Escape to close.
          Reduced-motion preferences are respected.
        </p>
        <button
          className="my-8 rounded-full border border-[#292722]/40 px-5 py-2 text-sm"
          onClick={() => setBook((v) => !v)}
        >
          {book ? "Hide" : "Try"} in the actual flipbook
        </button>
        {book && (
          <>
            <p className="mb-3 text-sm">
              The fold-out is attached to PDF page 2. Try zoom, page turns and
              Simple / Studio. Turn away and back to reset the flap.
            </p>
            <PdfViewer
              source={{ url: "/examples/photography.pdf" }}
              fileName="Photography example.pdf"
              startPage={2}
              foldouts={[item]}
              viewer={{
                ...DEFAULT_VIEWER,
                mode: "book",
                look: "studio",
                looks: ["clean", "studio"],
                studioBrightness: 0.64,
              }}
              controls
            />
          </>
        )}
      </div>
    </main>
  );
}
