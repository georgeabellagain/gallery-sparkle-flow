import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { PreviewChrome } from "@/components/products/PreviewChrome";
import { DEFAULT_VIEWER } from "@/lib/portfolia/store";
// TEMPORARY verification route; delete after checking.
export const Route = createFileRoute("/zz-preview-check")({ component: Check });
const source = { url: "/__pink_preview.pdf" };
function Check() {
  const [page, setPage] = useState(1);
  return (
    <div className="relative h-[700px] w-full overflow-hidden">
      <PdfViewer source={source} fileName="Pink" viewer={{ ...DEFAULT_VIEWER, mode: "book", look: "clean", modes: ["book"], looks: ["clean"], idleOrbit: "off" }} controls homepageExample pageArrows allowDownload={false} fullSpread onReaderPage={setPage} />
      <PreviewChrome buyUrl="https://example.com" pages={7} page={page} className="bottom-20" />
    </div>
  );
}
