import { uid } from "./assets";
import { importPdf } from "./pdf";
import { createPortfolio, mutate, updatePortfolio } from "./store";
import type { Item, LayoutId, Portfolio } from "./types";

export interface ProgressInfo {
  phase: string;
  percent: number;
  page?: number;
  total?: number;
}

/** Import a PDF into an existing (or new) portfolio as intact page items. */
export async function importPdfIntoPortfolio(
  file: File,
  opts: {
    portfolioId: string;
    projectId: string;
    onProgress: (info: ProgressInfo) => void;
  },
): Promise<{ pages: number }> {
  const result = await importPdf(file, opts.onProgress);

  mutate((doc) => {
    doc.assets[result.pdfAssetId] = {
      id: result.pdfAssetId,
      name: result.pdfName,
      mime: "application/pdf",
      bytes: result.pdfBytes,
      blobKey: result.pdfBlobKey,
      createdAt: Date.now(),
    };
    for (const page of result.pages) {
      doc.assets[page.assetId] = {
        id: page.assetId,
        name: `${result.pdfName} — page ${page.pageNumber}`,
        mime: "image/jpeg",
        bytes: page.bytes,
        width: page.width,
        height: page.height,
        blobKey: page.blobKey,
        sourcePdfId: result.pdfAssetId,
        pageNumber: page.pageNumber,
        createdAt: Date.now(),
      };
    }
    const p = doc.portfolios.find((x) => x.id === opts.portfolioId);
    const pr = p?.projects.find((x) => x.id === opts.projectId);
    if (!p || !pr) return;
    const items: Item[] = result.pages.map((page) => ({
      id: uid("it"),
      kind: "pdfPage",
      assetId: page.assetId,
      sourcePdfId: result.pdfAssetId,
      pageNumber: page.pageNumber,
      aspect: page.width / page.height,
      elements: [],
      hotspots: [],
    }));
    pr.items.push(...items);
    if (!pr.coverAssetId) pr.coverAssetId = result.pages[0]?.assetId;
    p.updatedAt = Date.now();
  });

  return { pages: result.pages.length };
}

export const TEMPLATES: {
  id: string;
  name: string;
  blurb: string;
  layout: LayoutId;
  apply: (p: Portfolio) => void;
}[] = [
  {
    id: "blank",
    name: "Blank canvas",
    blurb: "Nothing pre-filled. Start with an empty project.",
    layout: "scroll",
    apply: () => {},
  },
  {
    id: "series",
    name: "Single series",
    blurb: "One project, continuous scroll, title and intro text ready to edit.",
    layout: "scroll",
    apply: (p) => {
      const pr = p.projects[0];
      if (!pr) return;
      pr.items.push(
        { id: uid("it"), kind: "text", text: "Series title", style: { size: 30 } },
        {
          id: uid("it"),
          kind: "text",
          text: "A sentence or two about the work. Click to edit.",
          style: { size: 15 },
        },
      );
    },
  },
  {
    id: "studio",
    name: "Studio index",
    blurb: "Several projects with covers, shown as a grid.",
    layout: "grid",
    apply: (p) => {
      p.singleProjectDirect = false;
      p.projects[0]!.title = "Project one";
      p.projects.push(
        { id: uid("pr"), title: "Project two", items: [] },
        { id: uid("pr"), title: "Project three", items: [] },
      );
    },
  },
  {
    id: "book",
    name: "Printed book",
    blurb: "One project presented as a page-turn book.",
    layout: "book",
    apply: (p) => {
      p.projects[0]!.title = "Book";
    },
  },
];

export function createFromTemplate(templateId: string, title: string): string {
  const tpl = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]!;
  const id = createPortfolio({ title, layout: tpl.layout });
  updatePortfolio(id, (p) => {
    p.defaultLayout = tpl.layout;
    tpl.apply(p);
  });
  return id;
}
